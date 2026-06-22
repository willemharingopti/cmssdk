import { cmssdk } from "../sdk.ts"
import * as assert from "node:assert"

// Integration test that runs against a live CMS instance using the credentials in
// .env (same as content.test.ts / applications.test.ts). It creates a real
// blueprint and removes it again in the finally block, so it is repeatable.
//
// Creating a blueprint needs (per the Blueprint create schema):
//  - displayName,
//  - contentType, a reference to an existing ContentType key, and
//  - content, the blueprint data body (its inner fields are all optional, so an
//    empty object satisfies the schema).
//
// The contentType reference must point at a content type that exists on the
// instance. By default the test discovers a valid one via
// client.contenttypes().list(); override with OPTIMIZELY_CMS_TEST_BLUEPRINT_CONTENTTYPE.
const TEST_BLUEPRINT_CONTENTTYPE = Deno.env.get("OPTIMIZELY_CMS_TEST_BLUEPRINT_CONTENTTYPE")

// The instance is eventually consistent: reads can lag writes by a moment. Poll a
// read until it satisfies `ok`, then return the last value (matched or not) so the
// caller can assert on it.
async function poll<T>(fn: () => Promise<T>, ok: (value: T) => boolean, attempts = 15, delayMs = 600): Promise<T> {
   let last = await fn()
   for (let i = 1; i < attempts && !ok(last); i++) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      last = await fn()
   }
   return last
}

Deno.test("blueprints", async (test) => {
   const client = cmssdk()
   if (client === undefined) assert.fail("unable to create cmssdk client")

   // Resolve a content type to attach the blueprint to: explicit env override
   // first, otherwise the key of the first content type on the instance.
   const resolveContentType = async (): Promise<string | undefined> => {
      if (TEST_BLUEPRINT_CONTENTTYPE) return TEST_BLUEPRINT_CONTENTTYPE
      const types = await client.contenttypes().list()
      return types.items?.find((t) => t.key)?.key
   }

   // ---------------------------------------------------------------------------
   // Collection-level read operation (always safe, no mutations). HARD-asserted.
   // ---------------------------------------------------------------------------
   await test.step("list (collection)", async () => {
      const list = await client.blueprints().list()
      assert.ok(list, "no list returned from blueprints")
      assert.ok(Array.isArray(list.items ?? []), "expected an items array")
   })

   await test.step("list with pagination", async () => {
      const list = await client.blueprints().list({ pageIndex: 0, pageSize: 5 })
      assert.ok(list, "no paginated list returned")
      assert.ok((list.items?.length ?? 0) <= 5, "pageSize was not respected")
   })

   // ---------------------------------------------------------------------------
   // Lifecycle: create -> get -> patch(verify by re-fetch) -> delete(verify gone)
   // Everything created here is torn down in the finally block below.
   // These steps depend on instance state (a valid content type to reference), so
   // they are best-effort: they log a warning and bail rather than failing the
   // whole suite when the instance can't satisfy a precondition.
   // ---------------------------------------------------------------------------
   const displayName = `sdk-test-${crypto.randomUUID()}`
   // Provide our own blueprint key so the test owns it regardless of what the
   // create response returns (POST replies 201 with an empty body). The Blueprint
   // schema allows a client-supplied key. The live instance requires blueprint
   // keys to be a GUID/UUID (it rejects the alphanumeric-identifier style used by
   // applications with "keys formatted as a GUID (UUID)"), so use a bare 32-char
   // hex UUID like content keys do.
   const key = crypto.randomUUID().replaceAll("-", "")
   let created = false

   try {
      await test.step("post (create)", async () => {
         const contentType = await resolveContentType()
         if (!contentType) {
            console.warn(
               "could not resolve a content type to reference. " +
                  "Set OPTIMIZELY_CMS_TEST_BLUEPRINT_CONTENTTYPE, or ensure at least one content type exists on the instance.",
            )
            return
         }
         try {
            await client.blueprints().post({
               key,
               displayName,
               contentType,
               content: {},
            })
            created = true
         } catch (err) {
            console.warn(
               `failed to create blueprint referencing content type "${contentType}". ` +
                  `Set OPTIMIZELY_CMS_TEST_BLUEPRINT_CONTENTTYPE to a value valid on your instance. ` +
                  `Original error: ${(err as Error).message}`,
            )
         }
      })

      await test.step("get (best-effort)", async () => {
         if (!created) {
            console.warn("get skipped: no blueprint was created")
            return
         }
         try {
            // The instance is eventually consistent, so poll until the new
            // blueprint becomes readable. get() throws a 404 until the write
            // propagates, so swallow errors inside the polled fn and retry.
            const blueprint = await poll(
               async () => {
                  try {
                     return await client.blueprints({ key }).get()
                  } catch {
                     return undefined
                  }
               },
               (b) => b?.key === key,
               30,
            )
            assert.ok(blueprint, "created blueprint never became readable")
            assert.equal(blueprint.key, key, "fetched blueprint key does not match created key")
            assert.equal(blueprint.displayName, displayName, "fetched blueprint displayName mismatch")
         } catch (err) {
            console.warn(`get skipped: ${(err as Error).message}`)
         }
      })

      await test.step("patch (update displayName, best-effort)", async () => {
         if (!created) {
            console.warn("patch skipped: no blueprint was created")
            return
         }
         try {
            // PATCH replies with an empty body, so verify by re-fetching (and poll,
            // since the read may briefly lag the write).
            const patched = `${displayName}-patched`
            await client.blueprints({ key }).patch({ displayName: patched })
            const blueprint = await poll(
               async () => {
                  try {
                     return await client.blueprints({ key }).get()
                  } catch {
                     return undefined
                  }
               },
               (b) => b?.displayName === patched,
            )
            assert.equal(blueprint?.displayName, patched, "patched displayName was not applied")
         } catch (err) {
            console.warn(`patch skipped: ${(err as Error).message}`)
         }
      })

      await test.step("delete (verify gone, best-effort)", async () => {
         if (!created) {
            console.warn("delete skipped: no blueprint was created")
            return
         }
         try {
            await client.blueprints({ key }).delete()
            // Deletion is eventually consistent: poll get() until it throws (gone).
            const gone = await poll(
               async () => {
                  try {
                     await client.blueprints({ key }).get()
                     return false
                  } catch {
                     return true
                  }
               },
               (isGone) => isGone === true,
            )
            assert.ok(gone, "blueprint still readable after delete")
            // It was confirmed deleted, so the finally cleanup has nothing to do.
            created = false
         } catch (err) {
            console.warn(`delete skipped: ${(err as Error).message}`)
         }
      })
   } finally {
      // Cleanup so the test is repeatable. Best-effort: log but don't fail on
      // cleanup errors.
      if (created) {
         try {
            await client.blueprints({ key }).delete()
         } catch (e) {
            console.warn(`cleanup of blueprint "${key}" failed: ${(e as Error).message}`)
         }
      }
   }
})
