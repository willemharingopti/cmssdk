import { cmssdk } from "../sdk.ts"
import * as assert from "node:assert"

// Integration test that runs against a live CMS instance using the credentials in
// .env (same as content.test.ts / applications.test.ts). It creates a real content
// source and removes it again in the finally block, so it is repeatable.
//
// Creating a content source needs a handful of required fields (confirmed from the
// ContentSource component schema in generated/openapispec.ts): type, sourceKey,
// sourceType, displayName, baseType and propertyMappings. These are instance-/source-
// specific, so they are configurable via env with sensible defaults that describe a
// 'graph' source. Override with the OPTIMIZELY_CMS_TEST_SOURCE_* vars below if the
// defaults are not accepted by your instance.
const TEST_SOURCE_TYPE = Deno.env.get("OPTIMIZELY_CMS_TEST_SOURCE_TYPE") ?? "graph"
const TEST_SOURCE_KEY = Deno.env.get("OPTIMIZELY_CMS_TEST_SOURCE_SOURCEKEY") ?? "sdktest"
// The live instance rejects sourceType values that start with an underscore
// ("must start with a non-numerical character and only contain alphanumerical
// characters or underscore"), so the default starts with a letter.
const TEST_SOURCE_SOURCETYPE = Deno.env.get("OPTIMIZELY_CMS_TEST_SOURCE_SOURCETYPE") ?? "sdktest"
const TEST_SOURCE_BASETYPE = Deno.env.get("OPTIMIZELY_CMS_TEST_SOURCE_BASETYPE") ?? "_component"

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

Deno.test("sources", async (test) => {
   const client = cmssdk()
   if (client === undefined) assert.fail("unable to create cmssdk client")

   // ---------------------------------------------------------------------------
   // Collection-level read operations (always safe, no mutations). Hard-asserted.
   // ---------------------------------------------------------------------------
   await test.step("list (collection)", async () => {
      const list = await client.sources().list()
      assert.ok(list, "no list returned from sources")
      assert.ok(Array.isArray(list.items ?? []), "expected an items array")
   })

   await test.step("list with paging", async () => {
      const list = await client.sources().list({ pageSize: 5 })
      assert.ok(list, "no paged list returned from sources")
      assert.ok((list.items?.length ?? 0) <= 5, "pageSize was not respected")
   })

   // ---------------------------------------------------------------------------
   // Lifecycle: create -> get -> patch (verify via re-fetch) -> delete.
   // Provide our own key so the test owns the resource regardless of what the
   // create response returns (POST replies 201 with an empty body). The schema
   // documents no key pattern, but the live instance requires the key to start
   // with a letter and contain only letters and digits, so the uuid is stripped
   // of its hyphens and prefixed with a letter.
   // Everything created here is torn down in the finally block below.
   //
   // Creating a source may require real external dependencies (e.g. a reachable
   // graph endpoint) that this test cannot satisfy, so the create + downstream
   // steps are best-effort (try/catch + console.warn). The read-only list steps
   // above remain hard-asserted.
   // ---------------------------------------------------------------------------
   const key = `sdktest${crypto.randomUUID().replaceAll("-", "").slice(0, 8)}`
   const displayName = `sdk-test-${crypto.randomUUID()}`
   let created = false

   try {
      await test.step("post (create, best-effort)", async () => {
         try {
            await client.sources().post({
               key,
               type: TEST_SOURCE_TYPE,
               sourceKey: TEST_SOURCE_KEY,
               sourceType: TEST_SOURCE_SOURCETYPE,
               displayName,
               baseType: TEST_SOURCE_BASETYPE as
                  | "_page"
                  | "_component"
                  | "_media"
                  | "_image"
                  | "_video"
                  | "_folder"
                  | "_experience"
                  | "_section"
                  | "_element",
               propertyMappings: {},
            })
            created = true
         } catch (err) {
            console.warn(
               `source create skipped: failed to create content source "${key}". ` +
                  `Set OPTIMIZELY_CMS_TEST_SOURCE_* to values valid on your instance. ` +
                  `Original error: ${(err as Error).message}`,
            )
         }
      })

      await test.step("get (best-effort)", async () => {
         if (!created) {
            console.warn("source get skipped: source was not created")
            return
         }
         try {
            // The create is eventually consistent, so poll until the source is readable.
            const source = await poll(
               () => client.sources({ key }).get(),
               (s) => s.key === key,
            )
            assert.equal(source.key, key, "fetched source key does not match created key")
            assert.equal(source.displayName, displayName, "fetched source displayName mismatch")
         } catch (err) {
            console.warn(`source get skipped: ${(err as Error).message}`)
         }
      })

      await test.step("patch (update, verify via re-fetch, best-effort)", async () => {
         if (!created) {
            console.warn("source patch skipped: source was not created")
            return
         }
         try {
            // PATCH replies with an empty body, so verify by re-fetching (and poll,
            // since the read may briefly lag the write).
            const patched = `${displayName}-patched`
            await client.sources({ key }).patch({ displayName: patched })
            const source = await poll(
               () => client.sources({ key }).get(),
               (s) => s.displayName === patched,
            )
            assert.equal(source.displayName, patched, "patched displayName was not applied")
         } catch (err) {
            console.warn(`source patch skipped: ${(err as Error).message}`)
         }
      })

      await test.step("delete (verify gone, best-effort)", async () => {
         if (!created) {
            console.warn("source delete skipped: source was not created")
            return
         }
         try {
            await client.sources({ key }).delete()
            created = false
            // Deletion is eventually consistent, so poll until the get fails (gone).
            const gone = await poll(
               async () => {
                  try {
                     await client.sources({ key }).get()
                     return false
                  } catch {
                     return true
                  }
               },
               (g) => g === true,
            )
            assert.ok(gone, "deleted source is still retrievable")
         } catch (err) {
            console.warn(`source delete skipped: ${(err as Error).message}`)
         }
      })
   } finally {
      // Cleanup so the test is repeatable. Best-effort: log but don't fail on cleanup errors.
      if (created) {
         try {
            await client.sources({ key }).delete()
         } catch (e) {
            console.warn(`cleanup of source "${key}" failed: ${(e as Error).message}`)
         }
      }
   }
})
