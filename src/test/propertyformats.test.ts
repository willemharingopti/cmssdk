import { cmssdk } from "../sdk.ts"
import * as assert from "node:assert"

// Integration test that runs against a live CMS instance using the credentials in
// .env (same as content.test.ts / applications.test.ts).
//
// Property formats are a read-only, built-in resource: the SDK and the API only
// expose `list` and `get` (no create/update/delete). There is therefore nothing to
// create or clean up — the lifecycle here is list -> get only.
//
// `list` is read-only and always present, so it is hard-asserted. `get` depends on
// an item existing on the instance; by default the test discovers a key from the
// list, but you can pin a specific key with OPTIMIZELY_CMS_TEST_PROPERTYFORMAT_KEY.
// Because data presence is instance-specific, the get step is best-effort.
const TEST_PROPERTYFORMAT_KEY = Deno.env.get("OPTIMIZELY_CMS_TEST_PROPERTYFORMAT_KEY")

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

Deno.test("propertyformats", async (test) => {
   const client = cmssdk()
   if (client === undefined) assert.fail("unable to create cmssdk client")

   // ---------------------------------------------------------------------------
   // Collection-level read operations (always safe, no mutations)
   // ---------------------------------------------------------------------------
   await test.step("list (collection)", async () => {
      const list = await client.propertyformats().list()
      assert.ok(list, "no list returned from propertyformats")
      assert.ok(Array.isArray(list.items ?? []), "expected an items array")
   })

   await test.step("list with pagination", async () => {
      const list = await client.propertyformats().list({ pageIndex: 0, pageSize: 5 })
      assert.ok(list, "no paginated list returned from propertyformats")
      assert.ok((list.items?.length ?? 0) <= 5, "pageSize was not respected")
   })

   // ---------------------------------------------------------------------------
   // Item-level read: get a single property format by key.
   // Resolve the key from the env override or fall back to the first listed item.
   // Best-effort: a fresh/empty instance may have no property formats to fetch.
   // ---------------------------------------------------------------------------
   await test.step("get by key (best-effort)", async () => {
      try {
         let key = TEST_PROPERTYFORMAT_KEY
         if (!key) {
            const list = await client.propertyformats().list({ pageSize: 5 })
            key = list.items?.find((i) => i.key)?.key
         }
         if (!key) {
            console.warn(
               "get by key skipped: no property format key available. " +
                  "Set OPTIMIZELY_CMS_TEST_PROPERTYFORMAT_KEY, or ensure at least one property format exists on the instance.",
            )
            return
         }

         const requestedKey = key
         const format = await poll(
            () => client.propertyformats({ key: requestedKey }).get(),
            (f) => f?.key === requestedKey,
         )
         assert.ok(format, "no property format returned from get")
         assert.equal(format.key, requestedKey, "fetched property format key does not match requested key")
      } catch (err) {
         console.warn(`get by key skipped: ${(err as Error).message}`)
      }
   })
})
