import type { TypedSdkClient } from "./openapi/typedsdk.ts"
import type { paths } from "../generated/openapispec.ts"
import { handleerror } from "./utils.ts"

type ManifestExportResponse = paths["/manifest"]["get"]["responses"][200]["content"]["application/json"]
type ManifestExportQuery = paths["/manifest"]["get"]["parameters"]["query"]

type ManifestImportRequest = paths["/manifest"]["post"]["requestBody"]["content"]["application/json"]
// Import resolves to a result on 200 (OK). It may instead be accepted for
// asynchronous processing (202 Accepted), which carries no body.
type ManifestImportResult = paths["/manifest"]["post"]["responses"][200]["content"]["application/json"]
type ManifestImportResponse = ManifestImportResult | void

export interface ManifestApi {
  (): {
    /**
     * Exports the manifest.
     *
     * @param query - Optional sections to include and whether to include read-only resources
     * @returns Promise resolving to the exported manifest
     * @throws Error on 401, 403, 429, 500, or other failures
     *
     * @example
     * const manifest = await client.manifest().export({ sections: ["contentTypes", "locales"] })
     */
    export: (query?: ManifestExportQuery) => Promise<ManifestExportResponse>
    /**
     * Imports a manifest.
     *
     * @param body - The manifest to import
     * @returns Promise resolving to the import result (200 OK), or void when the
     *   import is accepted for asynchronous processing (202 Accepted, no body)
     * @throws Error on 400, 401, 403, 409, 429, 500
     *
     * @example
     * const result = await client.manifest().import(manifest)
     */
    import: (body: ManifestImportRequest) => Promise<ManifestImportResponse>
  }
}

// The manifest is a singleton resource (no key): it can be exported and imported.
export function createManifest(client: TypedSdkClient): ManifestApi {
  return () => ({
    export: async (query?: ManifestExportQuery): Promise<ManifestExportResponse> => {
      const res = await client.GET("/manifest", { params: { query } })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as ManifestExportResponse
    },

    import: async (body: ManifestImportRequest): Promise<ManifestImportResponse> => {
      const res = await client.POST("/manifest", { body })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as ManifestImportResponse // undefined on 202 Accepted
    },
  })
}

export type iManifest = ManifestApi