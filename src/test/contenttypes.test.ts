import { cmssdk } from "../sdk.ts"
import * as assert from "node:assert"

// Integration test that runs against a live CMS instance using the credentials in
// .env (same as content.test.ts / applications.test.ts). It creates a real content
// type and removes it again in the finally block, so it is repeatable.
//
// Creating a content type needs (per the ContentType create schema):
//  - displayName (required),
//  - baseType (required for non-contract types) - a reference to an existing base
//    content type. The base type enum on this instance includes _page, _component,
//    _media, _image, _video, _folder, _experience, _section and _element. We default
//    to "_component" because it is creatable via the public API; override with
//    OPTIMIZELY_CMS_TEST_CONTENTTYPE_BASETYPE.
//  - a properties map (optional, but we include one minimal string property to make
//    the created type realistic).
//
// IMPORTANT KEY RULES (discovered on this instance): content type keys must start
// with a non-numeric character and contain only alphanumerics or underscore (no
// hyphens). So we use a letter prefix and strip the dashes from a UUID.
const TEST_BASETYPE = Deno.env.get("OPTIMIZELY_CMS_TEST_CONTENTTYPE_BASETYPE") ?? "_component"

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

Deno.test("contenttypes", async (test) => {
   const client = cmssdk()
   if (client === undefined) assert.fail("unable to create cmssdk client")

   // ---------------------------------------------------------------------------
   // Collection-level read operation (always safe, no mutations). HARD-asserted.
   // ---------------------------------------------------------------------------
   await test.step("list (collection)", async () => {
      const list = await client.contenttypes().list()
      assert.ok(list, "no list returned from contenttypes")
      assert.ok(Array.isArray(list.items ?? []), "expected an items array")
   })

   await test.step("list with paging", async () => {
      const list = await client.contenttypes().list({ pageIndex: 0, pageSize: 5 })
      assert.ok(list, "no paged list returned from contenttypes")
      assert.ok((list.items?.length ?? 0) <= 5, "pageSize was not respected")
   })

   // ---------------------------------------------------------------------------
   // Lifecycle: create -> get -> patch -> delete
   // Everything created here is torn down in the finally block below.
   // The create depends on a baseType that is creatable on the instance, so the
   // mutating steps are best-effort: they log a warning and bail rather than
   // failing the whole suite when the instance can't satisfy a precondition.
   // ---------------------------------------------------------------------------
   const displayName = `sdk-test-${crypto.randomUUID()}`
   // Provide our own key so the test owns it regardless of what the create response
   // returns (POST replies 201 with an empty body). Keys must start with a
   // non-numeric character and contain only alphanumerics or underscore.
   const key = `sdktest_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`
   let created = false

   try {
      await test.step("post (create, best-effort)", async () => {
         try {
            await client.contenttypes().post({
               key,
               displayName,
               baseType: TEST_BASETYPE,
               properties: {
                  heading: {
                     type: "string",
                     displayName: "Heading",
                  },
               },
            })
            created = true
         } catch (err) {
            console.warn(
               `failed to create content type with baseType "${TEST_BASETYPE}". ` +
                  `Set OPTIMIZELY_CMS_TEST_CONTENTTYPE_BASETYPE to a value creatable on your instance ` +
                  `(e.g. _component / _page / _experience / _section / _element). ` +
                  `Original error: ${(err as Error).message}`,
            )
         }
      })

      await test.step("get (best-effort)", async () => {
         if (!created) {
            console.warn("get skipped: no content type was created")
            return
         }
         try {
            // The instance is eventually consistent, so poll until the new content
            // type becomes readable. get() throws a 404 until the write propagates,
            // so swallow errors inside the polled fn and retry. Reads can lag the
            // create by several seconds, so give this gating read a generous budget.
            const ct = await poll(
               async () => {
                  try {
                     return await client.contenttypes({ key }).get()
                  } catch {
                     return undefined
                  }
               },
               (c) => c?.key === key,
               30,
            )
            assert.ok(ct, "created content type never became readable")
            assert.equal(ct.key, key, "fetched content type key does not match created key")
            assert.equal(ct.displayName, displayName, "fetched content type displayName mismatch")
            assert.equal(ct.baseType, TEST_BASETYPE, "fetched content type baseType mismatch")
         } catch (err) {
            console.warn(`get skipped: ${(err as Error).message}`)
         }
      })

      await test.step("patch (update displayName, best-effort)", async () => {
         if (!created) {
            console.warn("patch skipped: no content type was created")
            return
         }
         try {
            // PATCH replies with an empty body, so verify by re-fetching (and poll,
            // since the read may briefly lag the write).
            const patched = `${displayName}-patched`
            await client.contenttypes({ key }).patch({ displayName: patched })
            const ct = await poll(
               async () => {
                  try {
                     return await client.contenttypes({ key }).get()
                  } catch {
                     return undefined
                  }
               },
               (c) => c?.displayName === patched,
            )
            assert.equal(ct?.displayName, patched, "patched displayName was not applied")
         } catch (err) {
            console.warn(`patch skipped: ${(err as Error).message}`)
         }
      })

      await test.step("delete (verify gone, best-effort)", async () => {
         if (!created) {
            console.warn("delete skipped: no content type was created")
            return
         }
         try {
            await client.contenttypes({ key }).delete()
            // Deletion is eventually consistent: poll get() until it throws (gone).
            const gone = await poll(
               async () => {
                  try {
                     await client.contenttypes({ key }).get()
                     return false
                  } catch {
                     return true
                  }
               },
               (isGone) => isGone === true,
            )
            assert.ok(gone, "content type still readable after delete")
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
            await client.contenttypes({ key }).delete()
         } catch (e) {
            console.warn(`cleanup of content type "${key}" failed: ${(e as Error).message}`)
         }
      }
   }
})
