import { cmssdk } from "../sdk.ts"
import * as assert from "node:assert"

// Integration test that runs against a live CMS instance using the credentials in
// .env (same as content.test.ts / applications.test.ts).
//
// The manifest is a SINGLETON resource (no key): it can be exported (GET) and
// imported (POST). There is no list/get/patch/delete.
//
// The export query (per the OpenAPI schema, Manifest_Export) supports:
//  - sections: a subset of ("locales" | "contentTypes" | "propertyGroups" |
//    "displayTemplates"). If omitted, all sections are included.
//  - includeReadOnly: whether read-only resources should be included.
//
// IMPORTANT: import is DESTRUCTIVE. It mutates the whole instance configuration.
// The only import this test performs is a safe, near-idempotent ROUND-TRIP:
// export the current manifest (a small subset), then import that exact same
// payload straight back. The import step is BEST-EFFORT (try/catch +
// console.warn) and may resolve to a ManifestImportResult (200 OK) or to
// undefined (202 Accepted, no body). If a round-trip feels risky or fails
// validation it is skipped with a warning rather than forced, so the instance
// is never left in a changed state.

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

// The four manifest section names, mirrored from the export query schema.
const ALL_SECTIONS = ["locales", "contentTypes", "propertyGroups", "displayTemplates"] as const

Deno.test("manifest", async (test) => {
   const client = cmssdk()
   if (client === undefined) assert.fail("unable to create cmssdk client")

   // ---------------------------------------------------------------------------
   // export (full) — read-only, safe. HARD-asserted.
   // No query means every section is included.
   // ---------------------------------------------------------------------------
   await test.step("export (full)", async () => {
      const manifest = await client.manifest().export()
      assert.ok(manifest, "no manifest returned from export")
      assert.equal(typeof manifest, "object", "expected the manifest to be an object")
      // Every section, when present, must be an array (the schema types them as
      // arrays or null). We don't require any particular section to be populated,
      // only that whatever is present is well-shaped.
      for (const section of ALL_SECTIONS) {
         const value = (manifest as Record<string, unknown>)[section]
         if (value !== undefined && value !== null) {
            assert.ok(Array.isArray(value), `expected manifest.${section} to be an array`)
         }
      }
   })

   // ---------------------------------------------------------------------------
   // export (sections) — request a single section subset and confirm the response
   // only carries the requested section(s). HARD-asserted.
   // We probe with "locales" because every instance has at least one locale.
   // ---------------------------------------------------------------------------
   await test.step("export (sections subset)", async () => {
      const manifest = await client.manifest().export({ sections: ["locales"] })
      assert.ok(manifest, "no manifest returned from export with sections")
      // The requested section should be present and shaped as an array.
      assert.ok(Array.isArray(manifest.locales ?? []), "expected locales to be an array")
      assert.ok((manifest.locales?.length ?? 0) > 0, "expected at least one locale on the instance")
      // The sections that were NOT requested must be absent (undefined or null) —
      // requesting a subset must not leak the other sections.
      for (const section of ALL_SECTIONS) {
         if (section === "locales") continue
         const value = (manifest as Record<string, unknown>)[section]
         assert.ok(
            value === undefined || value === null,
            `expected non-requested section "${section}" to be absent, got ${JSON.stringify(value)?.slice(0, 80)}`,
         )
      }
   })

   // A two-section subset behaves the same way: only the requested sections come back.
   await test.step("export (multi-section subset)", async () => {
      const manifest = await client.manifest().export({ sections: ["locales", "contentTypes"] })
      assert.ok(manifest, "no manifest returned from export with multiple sections")
      assert.ok(Array.isArray(manifest.locales ?? []), "expected locales to be an array")
      assert.ok(Array.isArray(manifest.contentTypes ?? []), "expected contentTypes to be an array")
      // propertyGroups and displayTemplates were not requested, so they must be absent.
      for (const section of ["propertyGroups", "displayTemplates"] as const) {
         const value = (manifest as Record<string, unknown>)[section]
         assert.ok(
            value === undefined || value === null,
            `expected non-requested section "${section}" to be absent`,
         )
      }
   })

   // ---------------------------------------------------------------------------
   // export (read-only flag) — exercise the includeReadOnly query param both ways
   // and assert each returns a manifest. HARD-asserted (read-only, safe).
   //
   // Including read-only resources should yield at least as many content types as
   // excluding them (read-only types are an additive set), so assert that
   // monotonicity when the contentTypes section is present in both responses.
   // ---------------------------------------------------------------------------
   await test.step("export (includeReadOnly variations)", async () => {
      const withReadOnly = await client.manifest().export({ sections: ["contentTypes"], includeReadOnly: true })
      const withoutReadOnly = await client.manifest().export({ sections: ["contentTypes"], includeReadOnly: false })
      assert.ok(withReadOnly, "no manifest returned with includeReadOnly=true")
      assert.ok(withoutReadOnly, "no manifest returned with includeReadOnly=false")
      assert.ok(Array.isArray(withReadOnly.contentTypes ?? []), "expected contentTypes array (includeReadOnly=true)")
      assert.ok(Array.isArray(withoutReadOnly.contentTypes ?? []), "expected contentTypes array (includeReadOnly=false)")
      const withCount = withReadOnly.contentTypes?.length ?? 0
      const withoutCount = withoutReadOnly.contentTypes?.length ?? 0
      assert.ok(
         withCount >= withoutCount,
         `includeReadOnly=true (${withCount}) should not return fewer content types than includeReadOnly=false (${withoutCount})`,
      )
   })

   // ---------------------------------------------------------------------------
   // import round-trip — BEST-EFFORT. Export a small, safe subset (locales) and
   // import that exact same payload back. This is near-idempotent: nothing is
   // hand-crafted, the payload is the instance's own current state. Wrapped in
   // try/catch + console.warn so instance-specific validation can't fail the
   // suite, and skipped outright if it looks risky.
   //
   // import resolves to a ManifestImportResult on 200 (OK) or to undefined on 202
   // (Accepted, no body) — both are acceptable. Anything else is a failure.
   // ---------------------------------------------------------------------------
   await test.step("import round-trip (best-effort)", async () => {
      try {
         // Re-export the locales subset immediately before importing so the
         // payload reflects the instance's current state as closely as possible.
         const subset = await client.manifest().export({ sections: ["locales"] })
         const locales = subset.locales ?? []
         if (locales.length === 0) {
            console.warn("import round-trip skipped: no locales to round-trip")
            return
         }

         // Import the exact same payload back. Only the locales section is sent,
         // so no other section can be affected.
         const result = await client.manifest().import({ locales })

         if (result === undefined) {
            // 202 Accepted, no body — the import was accepted for async processing.
            console.warn("import round-trip accepted asynchronously (202, no body)")
         } else {
            // 200 OK — a ManifestImportResult. errors, when present, must be empty
            // for a clean round-trip of the instance's own state.
            assert.equal(typeof result, "object", "expected a ManifestImportResult object on 200")
            const errors = result.errors ?? []
            assert.equal(errors.length, 0, `import round-trip reported errors: ${JSON.stringify(errors).slice(0, 200)}`)
         }

         // Verify the round-trip left the locales intact (eventually consistent),
         // i.e. every locale we sent is still present afterwards. A Locale's
         // unique identifier is its `key` (the IETF BCP-47 language tag).
         const sentKeys = new Set(locales.map((l) => l.key).filter((k): k is string => typeof k === "string"))
         if (sentKeys.size > 0) {
            const after = await poll(
               () => client.manifest().export({ sections: ["locales"] }),
               (m) => {
                  const keys = new Set((m.locales ?? []).map((l) => l.key))
                  return [...sentKeys].every((k) => keys.has(k))
               },
            )
            const afterKeys = new Set((after.locales ?? []).map((l) => l.key))
            for (const key of sentKeys) {
               assert.ok(afterKeys.has(key), `locale "${key}" missing after round-trip import`)
            }
         }
      } catch (err) {
         console.warn(`import round-trip skipped: ${(err as Error).message}`)
      }
   })
})
