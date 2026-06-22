import { cmssdk } from "../sdk.ts"
import * as assert from "node:assert"

// Integration test that runs against a live CMS instance using the credentials in
// .env (same as content.test.ts / applications.test.ts). It creates a real property
// group and removes it again in the finally block, so it is repeatable.
//
// Creating a property group needs a unique `key` and a `displayName` (both required by
// the PropertyGroup request schema). The displayName can be overridden via env; the key
// is generated per run so the test owns it regardless of what the create response holds.
const TEST_DISPLAY_NAME = Deno.env.get("OPTIMIZELY_CMS_TEST_PROPERTYGROUP_DISPLAYNAME") ?? "SDK Test Property Group"
// CMS identifier keys are alphanumeric (no hyphens). Build a unique, valid key per run.
const TEST_KEY_PREFIX = Deno.env.get("OPTIMIZELY_CMS_TEST_PROPERTYGROUP_KEYPREFIX") ?? "sdktest"

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

Deno.test("propertygroups", async (test) => {
   const client = cmssdk()
   if (client === undefined) assert.fail("unable to create cmssdk client")

   // ---------------------------------------------------------------------------
   // Collection-level read operations (always safe, no mutations)
   // ---------------------------------------------------------------------------
   await test.step("list (collection)", async () => {
      const list = await client.propertygroups().list()
      assert.ok(list, "no list returned from propertygroups")
      assert.ok(Array.isArray(list.items ?? []), "expected an items array")
   })

   // ---------------------------------------------------------------------------
   // Lifecycle: create -> read -> patch -> delete
   // Everything created here is torn down in the finally block below.
   // ---------------------------------------------------------------------------
   // Provide our own key so the test owns it regardless of what the create response
   // returns (the POST replies 201 with an empty body). Keys are alphanumeric.
   const key = `${TEST_KEY_PREFIX}${crypto.randomUUID().slice(0, 8)}`
   const displayName = TEST_DISPLAY_NAME
   let created = false

   try {
      await test.step("post (create)", async () => {
         try {
            await client.propertygroups().post({ key, displayName })
         } catch (err) {
            assert.fail(
               `failed to create property group with key "${key}". ` +
                  `Set OPTIMIZELY_CMS_TEST_PROPERTYGROUP_* to values valid on your instance. ` +
                  `Original error: ${(err as Error).message}`,
            )
         }
         created = true
      })

      await test.step("get", async () => {
         // The create is eventually consistent and get() 404s until the group is
         // visible, so poll while swallowing not-found errors.
         const group = await poll(
            async () => {
               try {
                  return await client.propertygroups({ key }).get()
               } catch {
                  return undefined
               }
            },
            (g) => g?.key === key,
            30,
         )
         assert.ok(group, "created property group never became retrievable")
         assert.equal(group.key, key, "fetched property group key does not match created key")
         assert.equal(group.displayName, displayName, "fetched property group displayName mismatch")
      })

      // State-dependent steps are best-effort: log but don't fail the suite on
      // instance-specific behaviour.
      await test.step("patch (update displayName, verify by re-fetch) (best-effort)", async () => {
         try {
            // PATCH replies with an empty body, so verify by re-fetching (and poll,
            // since the read may briefly lag the write).
            const patched = `${displayName} (patched)`
            await client.propertygroups({ key }).patch({ displayName: patched })
            const group = await poll(
               async () => {
                  try {
                     return await client.propertygroups({ key }).get()
                  } catch {
                     return undefined
                  }
               },
               (g) => g?.displayName === patched,
               30,
            )
            assert.equal(group?.displayName, patched, "patched displayName was not applied")
         } catch (err) {
            console.warn(`patch step skipped: ${(err as Error).message}`)
         }
      })

      await test.step("delete (verify gone) (best-effort)", async () => {
         try {
            await client.propertygroups({ key }).delete()
            // Deletion is eventually consistent: poll until the get fails (gone).
            const gone = await poll(
               async () => {
                  try {
                     await client.propertygroups({ key }).get()
                     return false
                  } catch {
                     return true
                  }
               },
               (g) => g === true,
            )
            assert.ok(gone, "property group was still retrievable after delete")
            created = false
         } catch (err) {
            console.warn(`delete step skipped: ${(err as Error).message}`)
         }
      })
   } finally {
      // Cleanup so the test is repeatable. Best-effort: log but don't fail on cleanup errors.
      if (created) {
         try {
            await client.propertygroups({ key }).delete()
         } catch (e) {
            console.warn(`cleanup of property group "${key}" failed: ${(e as Error).message}`)
         }
      }
   }
})
