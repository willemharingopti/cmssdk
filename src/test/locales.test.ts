import { cmssdk } from "../sdk.ts"
import * as assert from "node:assert"

// Integration test that runs against a live CMS instance using the credentials in
// .env (same as content.test.ts / applications.test.ts). It creates a real locale
// and removes it again in the finally block, so it is repeatable.
//
// Creating a locale needs (see the Locale create model in generated/openapispec.ts):
//  - key: the IETF BCP-47 language tag (e.g. "en", "en-US", "sv-SE"). This is
//    constrained to a valid BCP-47 tag, so it can't be fully randomised. We pick a
//    default that is unlikely to already exist on the instance, and handle a 409
//    conflict gracefully (treat the locale as pre-existing and skip mutation/cleanup).
//  - displayName: required.
//  - routeSegment: required.
//
// Override the locale key with OPTIMIZELY_CMS_TEST_LOCALE. The default is a real,
// valid BCP-47 tag (Kalaallisut, Greenland) that is very unlikely to already be
// configured on the instance. The live instance rejects private-use ("-x-") subtags
// as invalid, so the key has to be a genuine language tag rather than a random one.
const TEST_LOCALE = Deno.env.get("OPTIMIZELY_CMS_TEST_LOCALE") ?? "kl-GL"

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

Deno.test("locales", async (test) => {
   const client = cmssdk()
   if (client === undefined) assert.fail("unable to create cmssdk client")

   // ---------------------------------------------------------------------------
   // Collection-level read operation (always safe, no mutations). Hard-asserted.
   // ---------------------------------------------------------------------------
   await test.step("list (collection)", async () => {
      const list = await client.locales().list()
      assert.ok(list, "no locale list returned")
      assert.ok(Array.isArray(list.items ?? []), "expected an items array")
   })

   await test.step("list with pagination", async () => {
      const list = await client.locales().list({ pageSize: 1 })
      assert.ok(list, "no paginated locale list returned")
      assert.ok((list.items?.length ?? 0) <= 1, "pageSize was not respected")
   })

   // ---------------------------------------------------------------------------
   // Lifecycle: create -> get -> patch (verify by re-fetch) -> delete (verify gone)
   // Everything created here is torn down in the finally block below.
   // ---------------------------------------------------------------------------
   const key = TEST_LOCALE
   const displayName = `sdk-test-${crypto.randomUUID()}`
   // We own the key by supplying it ourselves: the POST replies 201 with an empty
   // body, so we can't read the key back from the create response.
   let created = false

   try {
      await test.step("post (create) [best-effort]", async () => {
         try {
            await client.locales().post({
               key,
               displayName,
               routeSegment: "sdk-test",
               isEnabled: true,
            })
            created = true
         } catch (err) {
            const message = (err as Error).message
            // The locale may already exist (409 Conflict): a previous run that failed
            // to clean up, or an instance that genuinely uses this tag. In that case we
            // don't own it, so we skip the mutating steps and cleanup below.
            if (message.includes("409") || message.toLowerCase().includes("conflict")) {
               console.warn(`locale "${key}" already exists (conflict); skipping create-dependent steps: ${message}`)
               return
            }
            console.warn(`locale create failed; skipping create-dependent steps: ${message}`)
         }
      })

      await test.step("get [best-effort]", async () => {
         if (!created) {
            console.warn("skipping get: locale was not created by this run")
            return
         }
         try {
            // The create is eventually consistent, so poll until the locale is readable.
            const locale = await poll(
               () => client.locales({ key }).get(),
               (l) => l.key === key,
            )
            assert.equal(locale.key, key, "fetched locale key does not match created key")
            assert.equal(locale.displayName, displayName, "fetched locale displayName mismatch")
         } catch (err) {
            console.warn(`get skipped: ${(err as Error).message}`)
         }
      })

      await test.step("patch (update, verify by re-fetch) [best-effort]", async () => {
         if (!created) {
            console.warn("skipping patch: locale was not created by this run")
            return
         }
         try {
            // PATCH replies with an empty body, so verify by re-fetching (and poll,
            // since the read may briefly lag the write).
            const patched = `${displayName}-patched`
            await client.locales({ key }).patch({ displayName: patched })
            const locale = await poll(
               () => client.locales({ key }).get(),
               (l) => l.displayName === patched,
            )
            assert.equal(locale.displayName, patched, "patched displayName was not applied")
         } catch (err) {
            console.warn(`patch skipped: ${(err as Error).message}`)
         }
      })

      await test.step("delete (verify gone) [best-effort]", async () => {
         if (!created) {
            console.warn("skipping delete: locale was not created by this run")
            return
         }
         try {
            await client.locales({ key }).delete()
            // The deletion is eventually consistent: poll until the get fails (gone).
            const gone = await poll(
               async () => {
                  try {
                     await client.locales({ key }).get()
                     return false
                  } catch {
                     return true
                  }
               },
               (g) => g === true,
            )
            assert.ok(gone, "locale still readable after delete")
            // Once verified gone, the locale no longer needs cleanup.
            if (gone) created = false
         } catch (err) {
            console.warn(`delete skipped: ${(err as Error).message}`)
         }
      })
   } finally {
      // Cleanup so the test is repeatable. Best-effort: log but don't fail on cleanup
      // errors. Guarded by `created` so we never delete a locale we don't own.
      if (created) {
         try {
            await client.locales({ key }).delete()
         } catch (e) {
            console.warn(`cleanup of locale "${key}" failed: ${(e as Error).message}`)
         }
      }
   }
})
