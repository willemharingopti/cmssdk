import type { TypedSdkClient } from "./openapi/typedsdk.ts"
import type { paths } from "../generated/openapispec.ts"
import { handleerror } from "./utils.ts"
import { entityLogger } from "./logger/logging.ts"

// Entity-level logger scoped to this resource.
const log = entityLogger.getChild("sources")

type ContentSourceListResponse = paths["/contentsources"]["get"]["responses"][200]["content"]["application/json"]
type ContentSourceGetResponse = paths["/contentsources/{key}"]["get"]["responses"][200]["content"]["application/json"]

type ContentSourceCreateRequest = paths["/contentsources"]["post"]["requestBody"]["content"]["application/json"]
type ContentSourceCreateResponse = paths["/contentsources"]["post"]["responses"][201]["content"]["application/json"]

type ContentSourcePatchRequest = paths["/contentsources/{key}"]["patch"]["requestBody"]["content"]["application/merge-patch+json"]
type ContentSourcePatchResponse = paths["/contentsources/{key}"]["patch"]["responses"][200]["content"]["application/json"]

type ContentSourceDeleteResponse = paths["/contentsources/{key}"]["delete"]["responses"][200]["content"]["application/json"]

export type ContentSourceKeyParam = { key: string }
export type ContentSourceQueryParam = { pageIndex?: number; pageSize?: number }

export interface SourcesApi {
  (): {
    /**
     * List content sources.
     *
     * @param query - Optional pagination parameters
     * @returns Promise resolving to the paginated content source list
     * @throws Error on 401, 403, 429, 500, or other failures
     */
    list: (query?: ContentSourceQueryParam) => Promise<ContentSourceListResponse>

    /**
     * Creates a new content source.
     *
     * @param body - Content source data to create
     * @returns Promise resolving to the created content source
     * @throws Error on 400, 401, 403, 409, 429, 500
     */
    post: (body: ContentSourceCreateRequest) => Promise<ContentSourceCreateResponse>
  }
  (key: ContentSourceKeyParam): {
    /**
     * Retrieves a specific content source by key.
     *
     * @returns Promise resolving to the content source data
     * @throws Error if not found (404) or request fails
     */
    get: () => Promise<ContentSourceGetResponse>

    /**
     * Partially updates a content source using JSON Merge Patch.
     *
     * @param body - Fields to update (all optional)
     * @returns Promise resolving to the updated content source
     * @throws Error if not found (404), precondition fails (412), or validation fails
     */
    patch: (body: ContentSourcePatchRequest) => Promise<ContentSourcePatchResponse>

    /**
     * Deletes a content source. This operation cannot be undone.
     *
     * @returns Promise resolving to deletion confirmation or void
     * @throws Error if not found (404) or deletion fails
     */
    delete: () => Promise<ContentSourceDeleteResponse | void>
  }
}

export function createSources(client: TypedSdkClient): SourcesApi {
  // Collection-level operations
  function sources(): {
    list: (query?: ContentSourceQueryParam) => Promise<ContentSourceListResponse>

    post: (body: ContentSourceCreateRequest) => Promise<ContentSourceCreateResponse>
  }

  // Item-level operations
  function sources(key: ContentSourceKeyParam): {
    get: () => Promise<ContentSourceGetResponse>

    patch: (body: ContentSourcePatchRequest) => Promise<ContentSourcePatchResponse>

    delete: () => Promise<ContentSourceDeleteResponse | void>
  }

  // Implementation with optional parameter
  function sources(key?: ContentSourceKeyParam) {
    const listSources = async (query?: ContentSourceQueryParam): Promise<ContentSourceListResponse> => {
      log.debug("Listing content sources", { query })
      const res = await client.GET("/contentsources", { params: { query } })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to list content source: {error}", { error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as ContentSourceListResponse
    }

    const getSource = async (keyParam: ContentSourceKeyParam): Promise<ContentSourceGetResponse> => {
      log.debug("Fetching content source {key}", { key: keyParam.key })
      const res = await client.GET("/contentsources/{key}", { params: { path: keyParam } })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to fetch content source {key}: {error}", { key: keyParam.key, error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as ContentSourceGetResponse
    }

    const createSource = async (body: ContentSourceCreateRequest): Promise<ContentSourceCreateResponse> => {
      log.info("Creating content source")
      const res = await client.POST("/contentsources", { body })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to create content source: {error}", { error: errorMessage })
        throw new Error(errorMessage)
      }
      log.info("Created content source {key}", { key: (res.data as ContentSourceCreateResponse)?.key })
      return res.data as ContentSourceCreateResponse
    }

    const patchSource = async (keyParam: ContentSourceKeyParam, body: ContentSourcePatchRequest): Promise<ContentSourcePatchResponse> => {
      log.info("Patching content source {key}", { key: keyParam.key })
      const res = await client.PATCH("/contentsources/{key}", { params: { path: keyParam }, body })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to patch content source {key}: {error}", { key: keyParam.key, error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as ContentSourcePatchResponse
    }

    const deleteSource = async (keyParam: ContentSourceKeyParam): Promise<ContentSourceDeleteResponse | void> => {
      log.info("Deleting content source {key}", { key: keyParam.key })
      const res = await client.DELETE("/contentsources/{key}", { params: { path: keyParam } })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to delete content source {key}: {error}", { key: keyParam.key, error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as ContentSourceDeleteResponse | void
    }

    if (key) {
      return {
        get: async () => await getSource(key),
        patch: async (body: ContentSourcePatchRequest) => await patchSource(key, body),
        delete: async () => await deleteSource(key),
      }
    }

    return {
      list: async (query?: ContentSourceQueryParam) => await listSources(query),
      post: async (body: ContentSourceCreateRequest) => await createSource(body),
    }
  }

  return sources
}

export type iSources = SourcesApi