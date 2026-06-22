import type { TypedSdkClient } from "./openapi/typedsdk.ts"
import type { paths } from "../generated/openapispec.ts"
import { handleerror } from "./utils.ts"

type ContentTypeListResponse = paths["/contenttypes"]["get"]["responses"][200]["content"]["application/json"]
type ContentTypeGetResponse = paths["/contenttypes/{key}"]["get"]["responses"][200]["content"]["application/json"]

type RawContentTypeCreate = paths["/contenttypes"]["post"]["requestBody"]["content"]["application/json"]
type ContentTypeCreateResponse = paths["/contenttypes"]["post"]["responses"][201]["content"]["application/json"]

type ContentTypePatchRequest = paths["/contenttypes/{key}"]["patch"]["requestBody"]["content"]["application/merge-patch+json"]
type ContentTypePatchResponse = paths["/contenttypes/{key}"]["patch"]["responses"][200]["content"]["application/json"]

type ContentTypeDeleteResponse = paths["/contenttypes/{key}"]["delete"]["responses"][200]["content"]["application/json"]

export type ContentTypeKeyParam = { key: string }
export type ContentTypeQueryParam = { 
  forContainerType?: string
  sources?: string[]
  pageIndex?: number
  pageSize?: number 
}

// Allow passing baseType as a string reference for better hinting
type ContentTypeCreateRequest = Omit<RawContentTypeCreate, "baseType"> & {
  /**
   * The base type of this ContentType. 
   * Reference to an existing ContentType key (ignored for contract types; required for all others).
   */
  baseType?: string | null | RawContentTypeCreate["baseType"]
}


export interface ContentTypesApi {
  (): {
    /**
     * List content types.
     *
     * Retrieves a paginated list of all available content types. Results can be filtered by container type or source.
     *
     * @param query - Optional query parameters for pagination and filtering
     * @param query.forContainerType - Only include types that are available for creation under the provided container type
     * @param query.sources - Include content types from specified sources ('DEFAULT' for content types without a specific source)
     * @param query.pageIndex - Zero-based page index
     * @param query.pageSize - Number of results per page
     * @returns Promise resolving to paginated content type list
     * @throws Error on 401 (Unauthorized), 403 (Forbidden), 429 (TooManyRequests), 500 (Server error), or other failures
     *
     * @example
     * const contentTypes = await contenttypes().list()
     * const page2 = await contenttypes().list({ pageIndex: 1, pageSize: 50 })
     * const filtered = await contenttypes().list({ forContainerType: "folder" })
     */
    list: (query?: ContentTypeQueryParam) => Promise<ContentTypeListResponse>
    /**
     * Creates a new content type.
     *
     * @param body - Content type data to create
     * @param body.displayName - Human-readable display name (required)
     * @param body.baseType - Base type reference (e.g., 'component', 'block', etc.) - required for non-contract types
     * @param body.isContract - Specifies if this is a contract type
     * @returns Promise resolving to the created content type with assigned key
     * @throws Error on 400 (Bad request), 401 (Unauthorized), 403 (Forbidden), 409 (Conflict), 429 (TooManyRequests), 500 (Server error)
     *
     * @example
     * const newContentType = await contenttypes().post({
     *   displayName: "My Component",
     *   baseType: "component"
     * })
     */
    post: (body: ContentTypeCreateRequest) => Promise<ContentTypeCreateResponse>
  }
  (key: ContentTypeKeyParam): {
    /**
     * Retrieves a specific content type by key.
     *
     * @returns Promise resolving to the content type data
     * @throws Error if the content type is not found (404) or request fails
     *
     * @example
     * const contentType = await contenttypes({ key: "article" }).get()
     */
    get: () => Promise<ContentTypeGetResponse>
    /**
     * Partially updates a content type using JSON Merge Patch.
     *
     * Only provided fields are updated; omitted fields are unchanged.
     * Patching may result in data loss warnings that can be ignored with cms-ignore-data-loss-warnings header.
     *
     * @param body - Fields to update (all fields optional)
     * @returns Promise resolving to the updated content type
     * @throws Error if the content type is not found (404), precondition fails (412), or validation fails
     *
     * @example
     * const updated = await contenttypes({ key: "article" }).patch({
     *   displayName: "Updated Article"
     * })
     */
    patch: (body: ContentTypePatchRequest) => Promise<ContentTypePatchResponse>
    /**
     * Deletes a content type.
     *
     * This operation cannot be undone.
     *
     * @returns Promise resolving to deletion confirmation or void
     * @throws Error if the content type is not found (404) or deletion fails
     *
     * @example
     * await contenttypes({ key: "article" }).delete()
     */
    delete: () => Promise<ContentTypeDeleteResponse | void>
  }
}

export function createContentTypes(client: TypedSdkClient): ContentTypesApi {
  // Collection-level operations
  function contenttypes(): {
  list: (query?: ContentTypeQueryParam) => Promise<ContentTypeListResponse>

  post: (body: ContentTypeCreateRequest) => Promise<ContentTypeCreateResponse>
}

  // Item-level operations
  function contenttypes(key: ContentTypeKeyParam): {
  get: () => Promise<ContentTypeGetResponse>

  patch: (body: ContentTypePatchRequest) => Promise<ContentTypePatchResponse>

  delete: () => Promise<ContentTypeDeleteResponse | void>
}

  // Implementation with optional parameter
  function contenttypes(key?: ContentTypeKeyParam) {
  const listContentTypes = async (query?: ContentTypeQueryParam): Promise<ContentTypeListResponse> => {
    const res = await client.GET("/contenttypes", { params: { query } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentTypeListResponse
  }

  const getContentType = async (keyParam: ContentTypeKeyParam): Promise<ContentTypeGetResponse> => {
    const res = await client.GET("/contenttypes/{key}", { params: { path: keyParam } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentTypeGetResponse
  }

  const createContentType = async (body: ContentTypeCreateRequest): Promise<ContentTypeCreateResponse> => {
    const res = await client.POST("/contenttypes", { body: body as unknown as RawContentTypeCreate })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentTypeCreateResponse
  }

  const patchContentType = async (keyParam: ContentTypeKeyParam, body: ContentTypePatchRequest): Promise<ContentTypePatchResponse> => {
    const res = await client.PATCH("/contenttypes/{key}", { params: { path: keyParam }, headers: {"content-type": "application/merge-patch+json"}, body })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentTypePatchResponse
  }

  const deleteContentType = async (keyParam: ContentTypeKeyParam): Promise<ContentTypeDeleteResponse | void> => {
    const res = await client.DELETE("/contenttypes/{key}", { params: { path: keyParam } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentTypeDeleteResponse | void
  }

  if (key) {
    return {
      get: async () => await getContentType(key),
      patch: async (body: ContentTypePatchRequest) => await patchContentType(key, body),
      delete: async () => await deleteContentType(key),
    }
  }

  return {
    list: async (query?: ContentTypeQueryParam) => await listContentTypes(query),
    post: async (body: ContentTypeCreateRequest) => await createContentType(body),
  }
  }

  return contenttypes
}

export type iContentTypes = ContentTypesApi