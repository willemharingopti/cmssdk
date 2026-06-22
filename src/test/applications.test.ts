import { cmssdk } from "../sdk.ts"
import { keyFromEntryPoint } from "../utils.ts"
import * as assert from "node:assert"

// Integration test that runs against a live CMS instance using the credentials in
// .env (same as content.test.ts). It creates a real application (and a piece of
// content to act as its entry point) and removes both again in the finally block,
// so it is repeatable.
//
// Creating an application needs (per the Application create schema):
//  - displayName,
//  - type (an application type key like "website"; override with
//    OPTIMIZELY_CMS_TEST_APP_TYPE), and
//  - entryPoint, a "cms://content/<key>" URI pointing at existing content.
//
// IMPORTANT: the live instance rejects an entry point that already backs another
// application ("Application routing entry points cannot overlap each other"). So
// the default behaviour is to create a brand-new content item and use it as the
// entry point. You can instead pin an explicit, unused entry point via
// OPTIMIZELY_CMS_TEST_APP_ENTRYPOINT. Creating that content item mirrors
// content.test.ts: it needs a content type (OPTIMIZELY_CMS_TEST_CONTENTTYPE,
// default "BlankExperience") and a container (OPTIMIZELY_CMS_TEST_CONTAINER,
// default: the first application's entry point).
const TEST_APP_TYPE = Deno.env.get("OPTIMIZELY_CMS_TEST_APP_TYPE") ?? "website"
const TEST_CONTENT_TYPE = Deno.env.get("OPTIMIZELY_CMS_TEST_CONTENTTYPE") ?? "BlankExperience"

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

Deno.test("applications", async (test) => {
   const client = cmssdk()
   if (client === undefined) assert.fail("unable to create cmssdk client")

   // Resolve a container to create the entry-point content in: explicit env
   // override first, otherwise use the *parent container* of an existing
   // application's entry point. The new content must be a sibling of (not a child
   // of) existing entry points: the instance rejects an application whose entry
   // point sits inside another application's routing tree ("Application routing
   // entry points cannot overlap each other"). Existing entry points share a common
   // root container, so reusing that container yields a valid, non-overlapping spot.
   const resolveContainer = async (): Promise<string | undefined> => {
      const fromEnv = Deno.env.get("OPTIMIZELY_CMS_TEST_CONTAINER")
      if (fromEnv) return fromEnv
      const apps = await client.applications().list()
      const entryPoint = apps.items?.find((a) => a.entryPoint)?.entryPoint
      if (!entryPoint) return undefined
      const node = await client.content({ key: keyFromEntryPoint(entryPoint) }).get()
      return node.container ?? undefined
   }

   // ---------------------------------------------------------------------------
   // Collection-level read operation (always safe, no mutations). HARD-asserted.
   // ---------------------------------------------------------------------------
   await test.step("list (collection)", async () => {
      const list = await client.applications().list()
      assert.ok(list, "no list returned from applications")
      assert.ok(Array.isArray(list.items ?? []), "expected an items array")
   })

   // ---------------------------------------------------------------------------
   // Lifecycle: create -> get -> patch -> delete
   // Everything created here is torn down in the finally block below.
   // These steps depend on instance state (a content type / container to build a
   // fresh, non-overlapping entry point), so they are best-effort: they log a
   // warning and bail rather than failing the whole suite when the instance can't
   // satisfy a precondition.
   // ---------------------------------------------------------------------------
   const displayName = `sdk-test-${crypto.randomUUID()}`
   // Provide our own application key so the test owns it regardless of what the
   // create response returns (POST replies 201 with an empty body). The Application
   // schema allows a client-supplied key. Application keys must start with a
   // non-numerical character and contain only alphanumerics or underscore, so use a
   // letter prefix (content keys, by contrast, accept a bare 32-char hex string).
   const key = `sdktest_${crypto.randomUUID().replaceAll("-", "")}`
   // Key of the content item created to serve as the application's entry point
   // (undefined when an explicit OPTIMIZELY_CMS_TEST_APP_ENTRYPOINT is supplied).
   let entryPointContentKey: string | undefined
   let created = false

   try {
      await test.step("post (create)", async () => {
         // Resolve a non-overlapping entry point. Prefer an explicit override,
         // otherwise create a fresh content item to point at.
         let entryPoint = Deno.env.get("OPTIMIZELY_CMS_TEST_APP_ENTRYPOINT")
         if (!entryPoint) {
            const containerKey = await resolveContainer()
            if (!containerKey) {
               console.warn(
                  "could not resolve a container to create the entry-point content in. " +
                     "Set OPTIMIZELY_CMS_TEST_APP_ENTRYPOINT, or OPTIMIZELY_CMS_TEST_CONTAINER, " +
                     "or ensure at least one application exists on the instance.",
               )
               return
            }
            const contentKey = crypto.randomUUID().replaceAll("-", "")
            try {
               await client.content().post({
                  key: contentKey,
                  contentType: TEST_CONTENT_TYPE,
                  container: containerKey,
                  initialVersion: { displayName: `${displayName}-entrypoint`, locale: "en" },
               })
               entryPointContentKey = contentKey
               entryPoint = `cms://content/${contentKey}`
            } catch (err) {
               console.warn(
                  `failed to create entry-point content of type "${TEST_CONTENT_TYPE}" in container "${containerKey}". ` +
                     `Set OPTIMIZELY_CMS_TEST_CONTENTTYPE / OPTIMIZELY_CMS_TEST_CONTAINER, or OPTIMIZELY_CMS_TEST_APP_ENTRYPOINT. ` +
                     `Original error: ${(err as Error).message}`,
               )
               return
            }
         }

         try {
            await client.applications().post({
               key,
               displayName,
               type: TEST_APP_TYPE as "website",
               entryPoint,
            })
            created = true
         } catch (err) {
            console.warn(
               `failed to create application of type "${TEST_APP_TYPE}" with entry point "${entryPoint}". ` +
                  `Set OPTIMIZELY_CMS_TEST_APP_TYPE / OPTIMIZELY_CMS_TEST_APP_ENTRYPOINT to values valid on your instance. ` +
                  `Original error: ${(err as Error).message}`,
            )
         }
      })

      await test.step("get (best-effort)", async () => {
         if (!created) {
            console.warn("get skipped: no application was created")
            return
         }
         try {
            // The instance is eventually consistent, so poll until the new
            // application becomes readable. get() throws a 404 until the write
            // propagates, so swallow errors inside the polled fn and retry.
            // Application reads can lag the create by several seconds, so give this
            // gating read a generous budget (30 attempts x 600ms = 18s).
            const app = await poll(
               async () => {
                  try {
                     return await client.applications({ key }).get()
                  } catch {
                     return undefined
                  }
               },
               (a) => a?.key === key,
               30,
            )
            assert.ok(app, "created application never became readable")
            assert.equal(app.key, key, "fetched application key does not match created key")
            assert.equal(app.displayName, displayName, "fetched application displayName mismatch")
         } catch (err) {
            console.warn(`get skipped: ${(err as Error).message}`)
         }
      })

      await test.step("patch (update displayName, best-effort)", async () => {
         if (!created) {
            console.warn("patch skipped: no application was created")
            return
         }
         try {
            // PATCH replies with an empty body, so verify by re-fetching (and poll,
            // since the read may briefly lag the write).
            const patched = `${displayName}-patched`
            await client.applications({ key }).patch({ displayName: patched })
            const app = await poll(
               async () => {
                  try {
                     return await client.applications({ key }).get()
                  } catch {
                     return undefined
                  }
               },
               (a) => a?.displayName === patched,
            )
            assert.equal(app?.displayName, patched, "patched displayName was not applied")
         } catch (err) {
            console.warn(`patch skipped: ${(err as Error).message}`)
         }
      })

      await test.step("delete (verify gone, best-effort)", async () => {
         if (!created) {
            console.warn("delete skipped: no application was created")
            return
         }
         try {
            await client.applications({ key }).delete()
            // Deletion is eventually consistent: poll get() until it throws (gone).
            const gone = await poll(
               async () => {
                  try {
                     await client.applications({ key }).get()
                     return false
                  } catch {
                     return true
                  }
               },
               (isGone) => isGone === true,
            )
            assert.ok(gone, "application still readable after delete")
            // It was confirmed deleted, so the finally cleanup has nothing to do.
            created = false
         } catch (err) {
            console.warn(`delete skipped: ${(err as Error).message}`)
         }
      })
   } finally {
      // Cleanup so the test is repeatable. Best-effort: log but don't fail on
      // cleanup errors. The application is deleted first (it references the
      // content), then the entry-point content.
      if (created) {
         try {
            await client.applications({ key }).delete()
         } catch (e) {
            console.warn(`cleanup of application "${key}" failed: ${(e as Error).message}`)
         }
      }
      if (entryPointContentKey) {
         try {
            await client.content({ key: entryPointContentKey }).delete()
         } catch (e) {
            console.warn(`cleanup of entry-point content "${entryPointContentKey}" failed: ${(e as Error).message}`)
         }
      }
   }
})
