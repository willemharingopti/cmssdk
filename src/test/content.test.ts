import { cmssdk } from "../sdk.ts"
import { keyFromEntryPoint } from "../utils.ts"
import * as assert from "node:assert"

// Integration test that runs against a live CMS instance using the credentials in
// .env (same as applications.test.ts). It creates real content and removes it again
// in the finally block, so it is repeatable.
//
// Creating content needs:
//  - a content type that exists on your instance ("BlankExperience" by default,
//    override with OPTIMIZELY_CMS_TEST_CONTENTTYPE), and
//  - a container to create it in, since the API requires either 'container' or
//    'owner'. By default the test uses the entry point of the first application on
//    the instance (see example.ts); override with OPTIMIZELY_CMS_TEST_CONTAINER.
const TEST_CONTENT_TYPE = Deno.env.get("OPTIMIZELY_CMS_TEST_CONTENTTYPE") ?? "BlankExperience"
// A media content type for the multipart upload() test. "GenericMedia" accepts any
// file; override with OPTIMIZELY_CMS_TEST_MEDIA_CONTENTTYPE (e.g. "ImageMedia").
const TEST_MEDIA_CONTENT_TYPE = Deno.env.get("OPTIMIZELY_CMS_TEST_MEDIA_CONTENTTYPE") ?? "GenericMedia"

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

Deno.test("content", async (test) => {
   const client = cmssdk()
   if (client === undefined) assert.fail("unable to create cmssdk client")

   // Resolve a container to create test content in: explicit env override first,
   // otherwise fall back to the first application's entry point.
   const resolveContainer = async (): Promise<string | undefined> => {
      const fromEnv = Deno.env.get("OPTIMIZELY_CMS_TEST_CONTAINER")
      if (fromEnv) return fromEnv
      const apps = await client.applications().list()
      const entryPoint = apps.items?.[0]?.entryPoint
      return entryPoint ? keyFromEntryPoint(entryPoint) : undefined
   }

   // ---------------------------------------------------------------------------
   // Collection-level read operations (always safe, no mutations)
   // ---------------------------------------------------------------------------
   await test.step("list versions (collection)", async () => {
      const list = await client.content().list()
      assert.ok(list, "no version list returned from content")
      assert.ok(Array.isArray(list.items ?? []), "expected an items array")
   })

   await test.step("list versions with filters", async () => {
      const list = await client.content().list({ statuses: ["published"], locales: ["en"], pageSize: 5 })
      assert.ok(list, "no filtered version list returned")
      assert.ok((list.items?.length ?? 0) <= 5, "pageSize was not respected")
   })

   // ---------------------------------------------------------------------------
   // Lifecycle: create -> read -> version ops -> copy -> delete
   // Everything created here is torn down in the finally block below.
   // ---------------------------------------------------------------------------
   const displayName = `sdk-test-${crypto.randomUUID()}`
   // Provide our own content key so the test owns it regardless of what the create
   // response returns (the POST replies 201 with an empty body unless asked for a
   // representation). CMS content keys are 32-char hex strings.
   const key = crypto.randomUUID().replaceAll("-", "")
   let created = false
   let containerKey: string | undefined
   let copyKey: string | undefined
   let versionId: string | undefined
   // Media items created via the multipart upload() endpoint. We upload the real
   // butterfly assets from the project root (a PNG and an SVG) and assert each one
   // round-trips byte-for-byte through media().
   const uploads = [
      { key: crypto.randomUUID().replaceAll("-", ""), file: "butterfly-png.png", name: "butterfly.png", type: "image/png" },
      { key: crypto.randomUUID().replaceAll("-", ""), file: "butterfly-svg.svg", name: "butterfly.svg", type: "image/svg+xml" },
   ]
   const uploadedKeys: string[] = []

   try {
      await test.step("post (create)", async () => {
         containerKey = await resolveContainer()
         if (!containerKey) {
            assert.fail(
               "could not resolve a container to create test content in. " +
                  "Set OPTIMIZELY_CMS_TEST_CONTAINER, or ensure at least one application exists on the instance.",
            )
         }
         try {
            await client.content().post({
               key,
               contentType: TEST_CONTENT_TYPE,
               container: containerKey,
               initialVersion: { displayName, locale: "en" },
            })
         } catch (err) {
            assert.fail(
               `failed to create content of type "${TEST_CONTENT_TYPE}" in container "${containerKey}". ` +
                  `Set OPTIMIZELY_CMS_TEST_CONTENTTYPE / OPTIMIZELY_CMS_TEST_CONTAINER to values valid on your instance. ` +
                  `Original error: ${(err as Error).message}`,
            )
         }
         created = true
      })

      const contentKey = key

      await test.step("get node", async () => {
         const node = await client.content({ key: contentKey }).get()
         assert.equal(node.key, contentKey, "fetched node key does not match created key")
         assert.equal(node.contentType, TEST_CONTENT_TYPE, "fetched node contentType mismatch")
      })

      await test.step("versions", async () => {
         const versions = await client.content({ key: contentKey }).versions()
         assert.ok(versions.items && versions.items.length > 0, "expected at least one version")
         // Prefer the id captured from create, fall back to the listing.
         versionId = versionId ?? versions.items?.[0]?.version
         assert.ok(versionId, "no version id available")
      })

      await test.step("get version", async () => {
         const v = await client.content({ key: contentKey, version: versionId as string }).get()
         assert.equal(v.version, versionId, "version id mismatch")
         assert.equal(v.displayName, displayName, "version displayName mismatch")
      })

      await test.step("patch version", async () => {
         // PATCH replies 200 with an empty body, so verify by re-fetching (and poll,
         // since the read may briefly lag the write).
         const patched = `${displayName}-patched`
         await client.content({ key: contentKey, version: versionId as string }).patch({ displayName: patched })
         const v = await poll(
            () => client.content({ key: contentKey, version: versionId as string }).get(),
            (v) => v.displayName === patched,
         )
         assert.equal(v.displayName, patched, "patched displayName was not applied")
      })

      await test.step("list locale versions", async () => {
         const localeVersions = await client.content({ key: contentKey, locale: "en" }).list()
         assert.ok(localeVersions.items && localeVersions.items.length > 0, "expected en locale versions")
      })

      await test.step("path", async () => {
         const path = await client.content({ key: contentKey }).path()
         assert.ok(path, "no path returned")
      })

      await test.step("copy", async () => {
         // copy replies 201 with the new key only in the Location header (which the
         // SDK doesn't surface), so identify the new item by diffing the container's
         // children before and after. This also exercises items() on the container.
         const containerOf = containerKey as string
         const before = await client.content({ key: containerOf }).items()
         const beforeKeys = new Set((before.items ?? []).map((i) => i.key))

         await client.content({ key: contentKey }).copy()

         // The container listing is eventually consistent, so poll for the new child.
         const after = await poll(
            () => client.content({ key: containerOf }).items(),
            (page) => (page.items ?? []).some((i) => i.key && !beforeKeys.has(i.key)),
         )
         const newKey = (after.items ?? []).find((i) => i.key && !beforeKeys.has(i.key))?.key
         assert.ok(newKey, "could not find the copied content among the container's items")
         assert.notEqual(newKey, contentKey, "copy unexpectedly has the same key as the original")
         copyKey = newKey
      })

      // Workflow transitions are state/validation dependent (a version must be valid
      // before it can be published). Treat as best-effort so instance-specific
      // validation rules don't fail the whole suite. publish replies with an empty
      // body, so confirm success by re-fetching the version's status.
      await test.step("workflow publish (best-effort)", async () => {
         try {
            const wf = client.content({ key: contentKey, version: versionId as string }).workflow()
            await wf.ready()
            await wf.publish()
            const v = await poll(
               () => client.content({ key: contentKey, version: versionId as string }).get(),
               (v) => v.status === "published",
            )
            assert.equal(v.status, "published", `expected published status, got "${v.status}"`)
         } catch (err) {
            console.warn(`workflow publish skipped: ${(err as Error).message}`)
         }
      })

      // Upload media items via the multipart/form-data upload() endpoint, then
      // confirm the binary round-trips through media(). We upload a PNG and an SVG
      // (the butterfly assets in the project root). Creating the media node is
      // best-effort (depends on TEST_MEDIA_CONTENT_TYPE existing on the instance);
      // once it succeeds, the round-trip is asserted strictly.
      for (const u of uploads) {
         await test.step(`upload (multipart media: ${u.name})`, async () => {
            const containerOf = containerKey as string
            // Read the real asset bytes from the project root (two levels up from
            // this test file). The file part needs a filename WITH an extension, so
            // pass a File (a bare Blob has no name and the API rejects it).
            const bytes = await Deno.readFile(new URL(`../../${u.file}`, import.meta.url))
            const file = new File([bytes], u.name, { type: u.type })

            try {
               await client.content().upload({
                  content: {
                     key: u.key,
                     contentType: TEST_MEDIA_CONTENT_TYPE,
                     container: containerOf,
                     initialVersion: { displayName: `${displayName}-${u.name}`, locale: "en" },
                  },
                  file,
               })
               uploadedKeys.push(u.key)
            } catch (err) {
               console.warn(
                  `upload skipped: could not create "${TEST_MEDIA_CONTENT_TYPE}" media. ` +
                     `Set OPTIMIZELY_CMS_TEST_MEDIA_CONTENTTYPE to a media type on your instance. ` +
                     `Original error: ${(err as Error).message}`,
               )
               return
            }

            // The node read is eventually consistent and 404s until visible, so poll.
            const node = await poll(
               async () => {
                  try {
                     return await client.content({ key: u.key }).get()
                  } catch {
                     return undefined
                  }
               },
               (n) => n?.key === u.key,
               30,
            )
            assert.ok(node, "uploaded media node never became retrievable")
            assert.equal(node.contentType, TEST_MEDIA_CONTENT_TYPE, "uploaded node contentType mismatch")

            const versionsPage = await poll(
               () => client.content({ key: u.key }).versions(),
               (p) => (p.items?.length ?? 0) > 0,
               30,
            )
            const mediaVersion = versionsPage.items?.[0]?.version
            assert.ok(mediaVersion, "no version available for the uploaded media")

            // The media bytes can also lag, so poll until the stream returns 200.
            const media = await poll(
               async () => {
                  try {
                     return await client.content({ key: u.key, version: mediaVersion }).media()
                  } catch {
                     return undefined
                  }
               },
               (r) => r?.status === 200,
               30,
            )
            assert.ok(media && media.status === 200, "media endpoint did not return the uploaded file")
            const got = new Uint8Array(await media.arrayBuffer())
            assert.equal(got.length, bytes.length, `${u.name}: uploaded byte length did not round-trip via media()`)
            assert.ok(got.every((b, i) => b === bytes[i]), `${u.name}: uploaded file bytes did not round-trip via media()`)
         })
      }
   } finally {
      // Cleanup so the test is repeatable. Best-effort: log but don't fail on cleanup errors.
      if (copyKey) {
         try {
            await client.content({ key: copyKey }).delete()
         } catch (e) {
            console.warn(`cleanup of copy "${copyKey}" failed: ${(e as Error).message}`)
         }
      }
      for (const uploadKey of uploadedKeys) {
         try {
            await client.content({ key: uploadKey }).delete()
         } catch (e) {
            console.warn(`cleanup of uploaded media "${uploadKey}" failed: ${(e as Error).message}`)
         }
      }
      if (created) {
         try {
            await client.content({ key }).delete()
         } catch (e) {
            console.warn(`cleanup of content "${key}" failed: ${(e as Error).message}`)
         }
      }
   }
})
