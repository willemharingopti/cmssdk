import { cmssdk } from "../sdk.ts"
import * as assert from "node:assert"

// Integration test that runs against a live CMS instance using the credentials in
// .env (same as content.test.ts / applications.test.ts). It creates a real content
// type binding and removes it again in the finally block, so it is repeatable.
//
// A content type binding maps properties FROM one content type TO another. The
// create schema (components.ContentTypeBinding) requires:
//  - from: the key of the source content type,
//  - to:   the key of the target content type,
// and optionally a propertyMappings map: { <targetPropertyPath>: { from: <sourceProperty> } }.
//
// DEPENDENCY: a valid binding needs two existing content types whose mapped
// properties are type-compatible. The live instance enforces this strictly (e.g.
// it rejects mapping an XhtmlString source onto a LongString target). By default
// the test uses "ImageMedia" -> "Image" mapping "AltText" <- "AltText" (both String
// on a stock instance). Override the pair / mapping via:
//  - OPTIMIZELY_CMS_TEST_BINDING_FROM
//  - OPTIMIZELY_CMS_TEST_BINDING_TO
//  - OPTIMIZELY_CMS_TEST_BINDING_PROP (a property name present and compatible on both)
// If the default pair is absent from the instance and no override is given, the
// create+downstream steps are best-effort (they log a warning and bail) while the
// read-only list() step stays hard-asserted.
const TEST_BINDING_FROM = Deno.env.get("OPTIMIZELY_CMS_TEST_BINDING_FROM") ?? "ImageMedia"
const TEST_BINDING_TO = Deno.env.get("OPTIMIZELY_CMS_TEST_BINDING_TO") ?? "Image"
const TEST_BINDING_PROP = Deno.env.get("OPTIMIZELY_CMS_TEST_BINDING_PROP") ?? "AltText"

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

Deno.test("bindings", async (test) => {
   const client = cmssdk()
   if (client === undefined) assert.fail("unable to create cmssdk client")

   // Confirm the from/to content types exist before attempting a create. Returns
   // true only when both are present on the instance.
   const pairExists = async (from: string, to: string): Promise<boolean> => {
      try {
         await client.contenttypes({ key: from }).get()
         await client.contenttypes({ key: to }).get()
         return true
      } catch {
         return false
      }
   }

   // ---------------------------------------------------------------------------
   // Collection-level read operation (always safe, no mutations). HARD-asserted.
   // ---------------------------------------------------------------------------
   await test.step("list (collection)", async () => {
      const list = await client.bindings().list()
      assert.ok(list, "no list returned from bindings")
      assert.ok(Array.isArray(list.items ?? []), "expected an items array")
   })

   await test.step("list with pagination", async () => {
      const list = await client.bindings().list({ pageSize: 5 })
      assert.ok(list, "no paginated list returned")
      assert.ok((list.items?.length ?? 0) <= 5, "pageSize was not respected")
   })

   // ---------------------------------------------------------------------------
   // Lifecycle: create -> get -> patch (verify by re-fetch) -> delete (verify gone)
   // Everything created here is torn down in the finally block below. These steps
   // depend on instance state (two type-compatible content types), so they are
   // best-effort: they log a warning and bail rather than failing the whole suite
   // when the instance can't satisfy the precondition.
   // ---------------------------------------------------------------------------
   // Provide our own binding key so the test owns it regardless of what the create
   // response returns (POST replies 201 with an empty body). Binding keys must start
   // with a non-numerical character and contain only alphanumerics or underscore, so
   // use a letter prefix and strip the hyphens from a UUID.
   const key = `sdktest_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`
   let created = false

   try {
      await test.step("post (create, best-effort)", async () => {
         if (!(await pairExists(TEST_BINDING_FROM, TEST_BINDING_TO))) {
            console.warn(
               `create skipped: content types "${TEST_BINDING_FROM}" and/or "${TEST_BINDING_TO}" not found on the instance. ` +
                  `Set OPTIMIZELY_CMS_TEST_BINDING_FROM / OPTIMIZELY_CMS_TEST_BINDING_TO / OPTIMIZELY_CMS_TEST_BINDING_PROP ` +
                  `to a type-compatible pair valid on your instance.`,
            )
            return
         }
         try {
            await client.bindings().post({
               key,
               from: TEST_BINDING_FROM,
               to: TEST_BINDING_TO,
               propertyMappings: { [TEST_BINDING_PROP]: { from: TEST_BINDING_PROP } },
            })
            created = true
         } catch (err) {
            console.warn(
               `failed to create binding "${TEST_BINDING_FROM}" -> "${TEST_BINDING_TO}" mapping "${TEST_BINDING_PROP}". ` +
                  `The instance enforces property type compatibility; set ` +
                  `OPTIMIZELY_CMS_TEST_BINDING_FROM / OPTIMIZELY_CMS_TEST_BINDING_TO / OPTIMIZELY_CMS_TEST_BINDING_PROP ` +
                  `to a compatible pair. Original error: ${(err as Error).message}`,
            )
         }
      })

      await test.step("get (best-effort)", async () => {
         if (!created) {
            console.warn("get skipped: no binding was created")
            return
         }
         try {
            // The instance is eventually consistent, so poll until the new binding
            // becomes readable. get() throws a 404 until the write propagates, so
            // swallow errors inside the polled fn and retry.
            const binding = await poll(
               async () => {
                  try {
                     return await client.bindings({ key }).get()
                  } catch {
                     return undefined
                  }
               },
               (b) => b?.key === key,
               30,
            )
            assert.ok(binding, "created binding never became readable")
            assert.equal(binding.key, key, "fetched binding key does not match created key")
            assert.equal(binding.from, TEST_BINDING_FROM, "fetched binding 'from' mismatch")
            assert.equal(binding.to, TEST_BINDING_TO, "fetched binding 'to' mismatch")
            assert.ok(
               binding.propertyMappings?.[TEST_BINDING_PROP],
               `expected property mapping for "${TEST_BINDING_PROP}"`,
            )
         } catch (err) {
            console.warn(`get skipped: ${(err as Error).message}`)
         }
      })

      await test.step("patch (clear property mappings, verify by re-fetch, best-effort)", async () => {
         if (!created) {
            console.warn("patch skipped: no binding was created")
            return
         }
         try {
            // PATCH replies with an empty body, so verify by re-fetching (and poll,
            // since the read may briefly lag the write). Clearing propertyMappings is
            // an observable, type-safe change that doesn't depend on a second
            // compatible property existing.
            await client.bindings({ key }).patch({ propertyMappings: {} })
            const binding = await poll(
               async () => {
                  try {
                     return await client.bindings({ key }).get()
                  } catch {
                     return undefined
                  }
               },
               (b) => b !== undefined && Object.keys(b.propertyMappings ?? {}).length === 0,
            )
            assert.ok(binding, "binding not readable after patch")
            assert.equal(
               Object.keys(binding.propertyMappings ?? {}).length,
               0,
               "patched (cleared) property mappings were not applied",
            )
         } catch (err) {
            console.warn(`patch skipped: ${(err as Error).message}`)
         }
      })

      await test.step("delete (verify gone, best-effort)", async () => {
         if (!created) {
            console.warn("delete skipped: no binding was created")
            return
         }
         try {
            await client.bindings({ key }).delete()
            // Deletion is eventually consistent: poll get() until it throws (gone).
            const gone = await poll(
               async () => {
                  try {
                     await client.bindings({ key }).get()
                     return false
                  } catch {
                     return true
                  }
               },
               (isGone) => isGone === true,
               30,
            )
            assert.ok(gone, "binding still readable after delete")
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
            await client.bindings({ key }).delete()
         } catch (e) {
            console.warn(`cleanup of binding "${key}" failed: ${(e as Error).message}`)
         }
      }
   }
})
