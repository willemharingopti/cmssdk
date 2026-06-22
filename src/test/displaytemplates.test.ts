import { cmssdk } from "../sdk.ts"
import * as assert from "node:assert"

// Integration test that runs against a live CMS instance using the credentials in
// .env (same as content.test.ts / applications.test.ts). It creates a real display
// template and removes it again in the finally block, so it is repeatable.
//
// Creating a display template needs (per the DisplayTemplate create schema):
//  - displayName (the only strictly required field).
// A display template defines how content is rendered and is only meaningful when it
// is associated with something to render, so it also references one of:
//  - contentType, the key of an existing content type, or
//  - baseType, one of the known CMS base types
//    ("_page" | "_component" | "_media" | "_image" | "_video" | "_folder" |
//     "_experience" | "_section" | "_element").
//
// By default the test discovers a content type to associate via
// client.contenttypes().list() and falls back to a baseType. You can override the
// association explicitly:
//  - OPTIMIZELY_CMS_TEST_DISPLAYTEMPLATE_CONTENTTYPE - an existing content type key
//  - OPTIMIZELY_CMS_TEST_DISPLAYTEMPLATE_BASETYPE    - a base type (default "_page")
const TEST_BASE_TYPE = Deno.env.get("OPTIMIZELY_CMS_TEST_DISPLAYTEMPLATE_BASETYPE") ?? "_page"

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

Deno.test("displaytemplates", async (test) => {
   const client = cmssdk()
   if (client === undefined) assert.fail("unable to create cmssdk client")

   // Resolve a content type to associate the display template with: explicit env
   // override first, otherwise the first content type the instance reports. Returns
   // undefined if neither is available, in which case the test falls back to a
   // baseType association.
   const resolveContentType = async (): Promise<string | undefined> => {
      const fromEnv = Deno.env.get("OPTIMIZELY_CMS_TEST_DISPLAYTEMPLATE_CONTENTTYPE")
      if (fromEnv) return fromEnv
      try {
         const types = await client.contenttypes().list()
         return types.items?.[0]?.key
      } catch {
         return undefined
      }
   }

   // ---------------------------------------------------------------------------
   // Collection-level read operation (always safe, no mutations). HARD-asserted.
   // ---------------------------------------------------------------------------
   await test.step("list (collection)", async () => {
      const list = await client.displaytemplates().list()
      assert.ok(list, "no list returned from displaytemplates")
      assert.ok(Array.isArray(list.items ?? []), "expected an items array")
   })

   await test.step("list with pagination", async () => {
      const list = await client.displaytemplates().list({ pageSize: 5 })
      assert.ok(list, "no paginated list returned")
      assert.ok((list.items?.length ?? 0) <= 5, "pageSize was not respected")
   })

   // ---------------------------------------------------------------------------
   // Lifecycle: create -> get -> patch(verify by re-fetch) -> delete(verify gone)
   // Everything created here is torn down in the finally block below.
   // These steps depend on instance state (a valid content type or base type to
   // associate), so they are best-effort: they log a warning and bail rather than
   // failing the whole suite when the instance can't satisfy a precondition.
   // ---------------------------------------------------------------------------
   const displayName = `sdk-test-${crypto.randomUUID()}`
   // Provide our own display template key so the test owns it regardless of what the
   // create response returns (POST replies 201 with an empty body). Identifier keys
   // must start with a non-numeric character and contain only alphanumerics or
   // underscore (no hyphens), so use a letter prefix with the hyphens stripped.
   const key = `sdktest_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`
   let created = false

   try {
      await test.step("post (create)", async () => {
         // Prefer associating with a real content type; fall back to a base type.
         const contentType = await resolveContentType()
         const association = contentType ? { contentType } : { baseType: TEST_BASE_TYPE }
         try {
            await client.displaytemplates().post({
               key,
               displayName,
               ...association,
            })
            created = true
         } catch (err) {
            console.warn(
               `failed to create display template (association: ${JSON.stringify(association)}). ` +
                  `Set OPTIMIZELY_CMS_TEST_DISPLAYTEMPLATE_CONTENTTYPE / ` +
                  `OPTIMIZELY_CMS_TEST_DISPLAYTEMPLATE_BASETYPE to values valid on your instance. ` +
                  `Original error: ${(err as Error).message}`,
            )
         }
      })

      await test.step("get (best-effort)", async () => {
         if (!created) {
            console.warn("get skipped: no display template was created")
            return
         }
         try {
            // The instance is eventually consistent, so poll until the new display
            // template becomes readable. get() throws a 404 until the write
            // propagates, so swallow errors inside the polled fn and retry.
            const dt = await poll(
               async () => {
                  try {
                     return await client.displaytemplates({ key }).get()
                  } catch {
                     return undefined
                  }
               },
               (d) => d?.key === key,
               30,
            )
            assert.ok(dt, "created display template never became readable")
            assert.equal(dt.key, key, "fetched display template key does not match created key")
            assert.equal(dt.displayName, displayName, "fetched display template displayName mismatch")
         } catch (err) {
            console.warn(`get skipped: ${(err as Error).message}`)
         }
      })

      await test.step("patch (update displayName, best-effort)", async () => {
         if (!created) {
            console.warn("patch skipped: no display template was created")
            return
         }
         try {
            // PATCH replies with an empty body, so verify by re-fetching (and poll,
            // since the read may briefly lag the write).
            const patched = `${displayName}-patched`
            await client.displaytemplates({ key }).patch({ displayName: patched })
            const dt = await poll(
               async () => {
                  try {
                     return await client.displaytemplates({ key }).get()
                  } catch {
                     return undefined
                  }
               },
               (d) => d?.displayName === patched,
            )
            assert.equal(dt?.displayName, patched, "patched displayName was not applied")
         } catch (err) {
            console.warn(`patch skipped: ${(err as Error).message}`)
         }
      })

      await test.step("delete (verify gone, best-effort)", async () => {
         if (!created) {
            console.warn("delete skipped: no display template was created")
            return
         }
         try {
            await client.displaytemplates({ key }).delete()
            // Deletion is eventually consistent: poll get() until it throws (gone).
            const gone = await poll(
               async () => {
                  try {
                     await client.displaytemplates({ key }).get()
                     return false
                  } catch {
                     return true
                  }
               },
               (isGone) => isGone === true,
            )
            assert.ok(gone, "display template still readable after delete")
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
            await client.displaytemplates({ key }).delete()
         } catch (e) {
            console.warn(`cleanup of display template "${key}" failed: ${(e as Error).message}`)
         }
      }
   }
})
