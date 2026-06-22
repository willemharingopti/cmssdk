import type { TypedSdkClient } from "./openapi/typedsdk.ts"
import type { paths } from "../generated/openapispec.ts"
import { handleerror } from "./utils.ts"

// ============================================================================
// Response Types
// ============================================================================

type ContentNodeResponse = paths["/content/{key}"]["get"]["responses"][200]["content"]["application/json"]
type ContentCreateResponse = paths["/content"]["post"]["responses"][201]["content"]["application/json"]
type ContentCopyResponse = paths["/content/{key}:copy"]["post"]["responses"][201]["content"]["application/json"]
type ContentUndeleteResponse = paths["/content/{key}:undelete"]["post"]["responses"][200]["content"]["application/json"]
type ContentDeleteResponse = paths["/content/{key}"]["delete"]["responses"][200]["content"]["application/json"]
type ContentPatchResponse = paths["/content/{key}"]["patch"]["responses"][200]["content"]["application/json"]

type ContentAssetsResponse = paths["/content/{key}/assets"]["get"]["responses"][200]["content"]["application/json"]
type ContentItemsResponse = paths["/content/{key}/items"]["get"]["responses"][200]["content"]["application/json"]
type ContentPathResponse = paths["/content/{key}/path"]["get"]["responses"][200]["content"]["application/json"]

type ContentLocaleVersionsResponse = paths["/content/{key}/locales/{locale}"]["get"]["responses"][200]["content"]["application/json"]
type ContentDeleteLocaleResponse = paths["/content/{key}/locales/{locale}"]["delete"]["responses"][200]["content"]["application/json"]

type ContentVersionsResponse = paths["/content/{key}/versions"]["get"]["responses"][200]["content"]["application/json"]
type ContentCreateVersionResponse = paths["/content/{key}/versions"]["post"]["responses"][201]["content"]["application/json"]

type ContentVersionResponse = paths["/content/{key}/versions/{version}"]["get"]["responses"][200]["content"]["application/json"]
type ContentDeleteVersionResponse = paths["/content/{key}/versions/{version}"]["delete"]["responses"][200]["content"]["application/json"]
type ContentPatchVersionResponse = paths["/content/{key}/versions/{version}"]["patch"]["responses"][200]["content"]["application/json"]

type ContentApproveResponse = paths["/content/{key}/versions/{version}:approve"]["post"]["responses"][200]["content"]["application/json"]
type ContentDraftResponse = paths["/content/{key}/versions/{version}:draft"]["post"]["responses"][200]["content"]["application/json"]
type ContentPublishResponse = paths["/content/{key}/versions/{version}:publish"]["post"]["responses"][200]["content"]["application/json"]
type ContentReadyResponse = paths["/content/{key}/versions/{version}:ready"]["post"]["responses"][200]["content"]["application/json"]
type ContentRejectResponse = paths["/content/{key}/versions/{version}:reject"]["post"]["responses"][200]["content"]["application/json"]

// The media endpoint streams the raw media (the spec defines no JSON body), so expose the Response.
type ContentMediaResponse = Response
type ContentPreviewsResponse = paths["/content/{key}/versions/{version}/previews"]["get"]["responses"][200]["content"]["application/json"]

type ContentAllVersionsResponse = paths["/content/versions"]["get"]["responses"][200]["content"]["application/json"]

// ============================================================================
// Request Types
// ============================================================================

type RawContentCreate = paths["/content"]["post"]["requestBody"]["content"]["application/json"]
type ContentCreateRequest = RawContentCreate

// The multipart variant of the create endpoint: a JSON `content` part plus a binary `file`.
// The generated spec types `file` as `string`; widen it to the runtime binary types callers actually pass.
type ContentUploadRequest = {
  content: RawContentCreate
  file: Blob | File | Uint8Array | string
}

type ContentCopyRequest = NonNullable<paths["/content/{key}:copy"]["post"]["requestBody"]>["content"]["application/json"] | undefined
type ContentPatchNodeRequest = paths["/content/{key}"]["patch"]["requestBody"]["content"]["application/merge-patch+json"]

type ContentPatchVersionRequest = paths["/content/{key}/versions/{version}"]["patch"]["requestBody"]["content"]["application/merge-patch+json"]

type RawContentListQueryParams = paths["/content/versions"]["get"]["parameters"]["query"]
type ContentListQueryParams = RawContentListQueryParams extends infer T
  ? T & {
      statuses?: ("draft" | "ready" | "published" | "previous" | "scheduled" | "rejected" | "inReview") | ("draft" | "ready" | "published" | "previous" | "scheduled" | "rejected" | "inReview")[]
      locales?: string | string[]
    }
  : never

// ============================================================================
// Parameter Types
// ============================================================================

export type ContentKeyParam = { key: string }
export type ContentVersionParam = { key: string; version: string }
export type ContentLocaleParam = { key: string; locale: string }

// ============================================================================
// Collection-level operations (no key)
// ============================================================================

export interface ContentApi {
  (): {
    /**
     * Creates a new content item.
     *
     * @param body - Content item data to create
     * @param body.key - Unique identifier for the content (optional; auto-generated if not provided)
     * @param body.contentType - ContentType key for this item (required)
     * @param body.container - Optional container key for hierarchical content
     * @param body.owner - Optional owner key for asset relationships
     * @param body.initialVersion - Optional initial version payload (e.g. localized field data) for the new content
     * @returns Promise resolving to the created content node
     * @throws Error on 400 (Bad request), 401 (Unauthorized), 403 (Forbidden), 409 (Conflict), 429 (TooManyRequests), 500 (Server error)
     *
     * @example
     * const newContent = await content().post({
     *   contentType: "article",
     *   initialVersion: { data: { title: "My Article" } }
     * })
     */
    post: (body: ContentCreateRequest) => Promise<ContentCreateResponse>

    /**
     * Creates a new content item together with its binary media in a single
     * `multipart/form-data` request.
     *
     * Use this instead of `post` when the content item owns a media file (e.g. an
     * image or document). The request is encoded as `multipart/form-data`; the
     * `content-type` header (including the required boundary) is set automatically.
     *
     * @param body - Upload payload
     * @param body.content - Content item metadata to create (same shape as `post`)
     * @param body.file - The binary media file to upload (Blob/File/Uint8Array)
     * @returns Promise resolving to the created content node
     * @throws Error on 400 (Bad request), 401 (Unauthorized), 403 (Forbidden), 409 (Conflict), 429 (TooManyRequests), 500 (Server error)
     *
     * @example
     * const newImage = await content().upload({
     *   content: { contentType: "image" },
     *   file: myFileBlob,
     * })
     */
    upload: (body: ContentUploadRequest) => Promise<ContentCreateResponse>

    /**
     * Lists all content versions across all content items with optional filtering.
     *
     * @param params - Query parameters for filtering and pagination
     * @param params.locales - Optional list of locales to include (e.g., ['en', 'sv', 'NEUTRAL'])
     * @param params.statuses - Optional list of version statuses to include (e.g., ['draft', 'published'])
     * @param params.pageIndex - Zero-based page index for pagination
     * @param params.pageSize - Maximum items per page
     * @returns Promise resolving to a page of content versions
     * @throws Error on 401 (Unauthorized), 403 (Forbidden), 429 (TooManyRequests), 500 (Server error)
     *
     * @example
     * const versions = await content().list({
     *   locales: ['en'],
     *   statuses: ['published'],
     *   pageSize: 20
     * })
     */
    list: (params?: ContentListQueryParams) => Promise<ContentAllVersionsResponse>
  }
  (params: ContentVersionParam): {
    /**
     * Retrieves a specific version of this content item.
     *
     * @returns Promise resolving to the version data
     * @throws Error if the version is not found (404) or request fails
     *
     * @example
     * const version = await content({ key: "article-123", version: "v1" }).get()
     */
    get: () => Promise<ContentVersionResponse>

    /**
     * Partially updates a specific version.
     *
     * @param body - Fields to update
     * @returns Promise resolving to the updated version
     * @throws Error if the version is not found (404) or update fails
     */
    patch: (body: ContentPatchVersionRequest) => Promise<ContentPatchVersionResponse>

    /**
     * Deletes a specific version.
     *
     * @returns Promise resolving to deletion confirmation or void
     * @throws Error if the version is not found (404) or deletion fails
     */
    delete: () => Promise<ContentDeleteVersionResponse | void>

    /**
     * Gets media associated with this version.
     *
     * The endpoint streams raw media (no JSON body), so the raw `Response` is returned —
     * read it via `.blob()`, `.arrayBuffer()`, `.body`, or inspect `.headers`/`.url`.
     *
     * @returns Promise resolving to the raw fetch Response for the media
     * @throws Error if media is not found (404) or request fails
     */
    media: () => Promise<ContentMediaResponse>

    /**
     * Gets preview URLs for this version.
     *
     * @returns Promise resolving to preview URLs for different applications
     * @throws Error if previews are not available (404) or request fails
     */
    previews: () => Promise<ContentPreviewsResponse>

    /**
     * Publishing workflow operations for this version.
     */
    workflow: () => {
      /**
       * Moves version to ready state (ready for review/publishing).
       *
       * @returns Promise resolving to the version in ready state
       * @throws Error if the version is not found (404) or workflow fails
       */
      ready: () => Promise<ContentReadyResponse>

      /**
       * Approves a version (moves to publishable state).
       *
       * @returns Promise resolving to the approved version
       * @throws Error if the version is not found (404) or approval fails
       */
      approve: () => Promise<ContentApproveResponse>

      /**
       * Rejects a version (returns to draft).
       *
       * @returns Promise resolving to the rejected version
       * @throws Error if the version is not found (404) or rejection fails
       */
      reject: () => Promise<ContentRejectResponse>

      /**
       * Publishes a version (makes it live).
       *
       * @returns Promise resolving to the published version
       * @throws Error if the version is not found (404) or publishing fails
       */
      publish: () => Promise<ContentPublishResponse>

      /**
       * Moves a published version back to draft.
       *
       * @returns Promise resolving to the version in draft state
       * @throws Error if the version is not found (404) or transition fails
       */
      draft: () => Promise<ContentDraftResponse>
    }
  }
  (params: ContentLocaleParam): {
    /**
     * Lists all versions for a specific locale of this content item.
     *
     * @returns Promise resolving to the locale versions
     * @throws Error if the content or locale is not found (404) or request fails
     *
     * @example
     * const versions = await content({ key: "article-123", locale: "en" }).list()
     */
    list: () => Promise<ContentLocaleVersionsResponse>

    /**
     * Deletes a locale branch of this content item.
     *
     * Removes all versions for the specified locale.
     *
     * @returns Promise resolving to deletion confirmation or void
     * @throws Error if the locale is not found (404) or deletion fails
     */
    delete: () => Promise<ContentDeleteLocaleResponse | void>
  }
  (params: ContentKeyParam): {
    /**
     * Retrieves a specific content node by key.
     *
     * Gets the content node metadata and current version state.
     *
     * @returns Promise resolving to the content node
     * @throws Error if the content is not found (404) or request fails
     *
     * @example
     * const node = await content({ key: "article-123" }).get()
     */
    get: () => Promise<ContentNodeResponse>

    /**
     * Partially updates a content node using JSON Merge Patch.
     *
     * Only provided fields are updated; omitted fields are unchanged.
     *
     * @param body - Fields to update
     * @returns Promise resolving to the updated content node
     * @throws Error if the content is not found (404) or validation fails
     */
    patch: (body: ContentPatchNodeRequest) => Promise<ContentPatchResponse>

    /**
     * Deletes a content item.
     *
     * This operation cannot be undone (unless cms-permanent-delete is false).
     *
     * @returns Promise resolving to deletion confirmation or void
     * @throws Error if the content is not found (404) or deletion fails
     */
    delete: () => Promise<ContentDeleteResponse | void>

    /**
     * Creates a copy of the content item.
     *
     * @param options - Optional copy instructions
     * @returns Promise resolving to the new copied content node
     * @throws Error if the content is not found (404) or copy fails
     */
    copy: (options?: ContentCopyRequest) => Promise<ContentCopyResponse>

    /**
     * Restores a deleted content item.
     *
     * Only works for soft-deleted content.
     *
     * @returns Promise resolving to the restored content node
     * @throws Error if the content is not found or not deleted (404)
     */
    undelete: () => Promise<ContentUndeleteResponse>

    /**
     * Gets the hierarchical path of the content item.
     *
     * @returns Promise resolving to the content path
     * @throws Error if the content is not found (404) or request fails
     */
    path: () => Promise<ContentPathResponse>

    /**
     * Lists assets belonging to this content item.
     *
     * @returns Promise resolving to the list of assets
     * @throws Error if the content is not found (404) or request fails
     */
    assets: () => Promise<ContentAssetsResponse>

    /**
     * Lists content items in this container.
     *
     * Only works if this content is a container type.
     *
     * @returns Promise resolving to the list of contained items
     * @throws Error if the content is not found (404) or is not a container
     */
    items: () => Promise<ContentItemsResponse>

    /**
     * Lists all versions of this content item.
     *
     * @returns Promise resolving to the list of versions
     * @throws Error if the content is not found (404) or request fails
     *
     * @example
     * const versions = await content({ key: "article-123" }).versions()
     */
    versions: () => Promise<ContentVersionsResponse>

    /**
     * Creates a new version of this content item.
     *
     * @param body - Version creation data
     * @returns Promise resolving to the created version
     * @throws Error if the content is not found (404) or creation fails
     *
     * @example
     * const version = await content({ key: "article-123" }).createVersion({
     *   data: { title: "Updated Title" }
     * })
     */
    createVersion: (body: any) => Promise<ContentCreateVersionResponse>
  }
}

export function createContent(client: TypedSdkClient): ContentApi {
  function content(): {
  post: (body: ContentCreateRequest) => Promise<ContentCreateResponse>

  upload: (body: ContentUploadRequest) => Promise<ContentCreateResponse>

  list: (params?: ContentListQueryParams) => Promise<ContentAllVersionsResponse>
}

// ============================================================================
// Item-level operations with version (key + version)
// ============================================================================

  function content(params: ContentVersionParam): {
  get: () => Promise<ContentVersionResponse>

  patch: (body: ContentPatchVersionRequest) => Promise<ContentPatchVersionResponse>

  delete: () => Promise<ContentDeleteVersionResponse | void>

  media: () => Promise<ContentMediaResponse>

  previews: () => Promise<ContentPreviewsResponse>

  workflow: () => {
    ready: () => Promise<ContentReadyResponse>

    approve: () => Promise<ContentApproveResponse>

    reject: () => Promise<ContentRejectResponse>

    publish: () => Promise<ContentPublishResponse>

    draft: () => Promise<ContentDraftResponse>
  }
}

// ============================================================================
// Item-level operations with locale (key + locale)
// ============================================================================

  function content(params: ContentLocaleParam): {
  list: () => Promise<ContentLocaleVersionsResponse>

  delete: () => Promise<ContentDeleteLocaleResponse | void>
}

// ============================================================================
// Item-level operations (key only)
// ============================================================================

  function content(params: ContentKeyParam): {
  get: () => Promise<ContentNodeResponse>

  patch: (body: ContentPatchNodeRequest) => Promise<ContentPatchResponse>

  delete: () => Promise<ContentDeleteResponse | void>

  copy: (options?: ContentCopyRequest) => Promise<ContentCopyResponse>

  undelete: () => Promise<ContentUndeleteResponse>

  path: () => Promise<ContentPathResponse>

  assets: () => Promise<ContentAssetsResponse>

  items: () => Promise<ContentItemsResponse>

  versions: () => Promise<ContentVersionsResponse>

  createVersion: (body: any) => Promise<ContentCreateVersionResponse>
}

// ============================================================================
// Implementation
// ============================================================================

  function content(params?: ContentKeyParam | ContentVersionParam | ContentLocaleParam) {
  // Helper to detect param types
  const isVersionParam = (p: any): p is ContentVersionParam => p && 'version' in p && 'key' in p
  const isLocaleParam = (p: any): p is ContentLocaleParam => p && 'locale' in p && 'key' in p
  const isKeyParam = (p: any): p is ContentKeyParam => p && 'key' in p && !('version' in p) && !('locale' in p)

  // Collection-level
  const createContent = async (body: ContentCreateRequest): Promise<ContentCreateResponse> => {
    const res = await client.POST("/content", { body })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentCreateResponse
  }

  const uploadContent = async (body: ContentUploadRequest): Promise<ContentCreateResponse> => {
    // Send as multipart/form-data: a JSON `content` part plus the binary `file`.
    // Returning a FormData from bodySerializer lets fetch set the content-type header
    // with the required boundary (don't set it manually, or the boundary is lost).
    const res = await client.POST("/content", {
      body: body as any,
      bodySerializer: () => {
        const form = new FormData()
        form.append("content", new Blob([JSON.stringify(body.content)], { type: "application/json" }))
        form.append("file", body.file as Blob)
        return form
      },
    })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentCreateResponse
  }

  // Item-level
  const getNode = async (keyParam: ContentKeyParam): Promise<ContentNodeResponse> => {
    const res = await client.GET("/content/{key}", { params: { path: keyParam } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentNodeResponse
  }

  const patchNode = async (keyParam: ContentKeyParam, body: ContentPatchNodeRequest): Promise<ContentPatchResponse> => {
    const res = await client.PATCH("/content/{key}", { params: { path: keyParam }, headers: {"content-type": "application/merge-patch+json"}, body })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentPatchResponse
  }

  const deleteContent = async (keyParam: ContentKeyParam): Promise<ContentDeleteResponse | void> => {
    const res = await client.DELETE("/content/{key}", { params: { path: keyParam } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentDeleteResponse | void
  }

  const copyContent = async (keyParam: ContentKeyParam, options?: ContentCopyRequest): Promise<ContentCopyResponse> => {
    const res = await client.POST("/content/{key}:copy", { params: { path: keyParam }, body: options })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentCopyResponse
  }

  const undeleteContent = async (keyParam: ContentKeyParam): Promise<ContentUndeleteResponse> => {
    const res = await client.POST("/content/{key}:undelete", { params: { path: keyParam } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentUndeleteResponse
  }

  const getPath = async (keyParam: ContentKeyParam): Promise<ContentPathResponse> => {
    const res = await client.GET("/content/{key}/path", { params: { path: keyParam } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentPathResponse
  }

  const listAssets = async (keyParam: ContentKeyParam): Promise<ContentAssetsResponse> => {
    const res = await client.GET("/content/{key}/assets", { params: { path: keyParam } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentAssetsResponse
  }

  const listItems = async (keyParam: ContentKeyParam): Promise<ContentItemsResponse> => {
    const res = await client.GET("/content/{key}/items", { params: { path: keyParam } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentItemsResponse
  }

  const listVersions = async (keyParam: ContentKeyParam): Promise<ContentVersionsResponse> => {
    const res = await client.GET("/content/{key}/versions", { params: { path: keyParam } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentVersionsResponse
  }

  const createVersion = async (keyParam: ContentKeyParam, body: any): Promise<ContentCreateVersionResponse> => {
    const res = await client.POST("/content/{key}/versions", { params: { path: keyParam }, body })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentCreateVersionResponse
  }

  const getVersion = async (params: ContentVersionParam): Promise<ContentVersionResponse> => {
    const res = await client.GET("/content/{key}/versions/{version}", { params: { path: params } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentVersionResponse
  }

  const patchVersion = async (params: ContentVersionParam, body: ContentPatchVersionRequest): Promise<ContentPatchVersionResponse> => {
    const res = await client.PATCH("/content/{key}/versions/{version}", { params: { path: params }, headers: {"content-type": "application/merge-patch+json"}, body })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentPatchVersionResponse
  }

  const deleteVersion = async (params: ContentVersionParam): Promise<ContentDeleteVersionResponse | void> => {
    const res = await client.DELETE("/content/{key}/versions/{version}", { params: { path: params } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentDeleteVersionResponse | void
  }

  const getMedia = async (params: ContentVersionParam): Promise<ContentMediaResponse> => {
    // parseAs "stream" avoids attempting to JSON-parse the binary media body.
    const res = await client.GET("/content/{key}/versions/{version}/media", { params: { path: params }, parseAs: "stream" })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.response
  }

  const getPreviews = async (params: ContentVersionParam): Promise<ContentPreviewsResponse> => {
    const res = await client.GET("/content/{key}/versions/{version}/previews", { params: { path: params } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentPreviewsResponse
  }

  const approve = async (params: ContentVersionParam): Promise<ContentApproveResponse> => {
    const res = await client.POST("/content/{key}/versions/{version}:approve", { params: { path: params } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentApproveResponse
  }

  const draft = async (params: ContentVersionParam): Promise<ContentDraftResponse> => {
    const res = await client.POST("/content/{key}/versions/{version}:draft", { params: { path: params } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentDraftResponse
  }

  const publish = async (params: ContentVersionParam): Promise<ContentPublishResponse> => {
    const res = await client.POST("/content/{key}/versions/{version}:publish", { params: { path: params } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentPublishResponse
  }

  const ready = async (params: ContentVersionParam): Promise<ContentReadyResponse> => {
    const res = await client.POST("/content/{key}/versions/{version}:ready", { params: { path: params } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentReadyResponse
  }

  const reject = async (params: ContentVersionParam): Promise<ContentRejectResponse> => {
    const res = await client.POST("/content/{key}/versions/{version}:reject", { params: { path: params } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentRejectResponse
  }

  const listLocaleVersions = async (params: ContentLocaleParam): Promise<ContentLocaleVersionsResponse> => {
    const res = await client.GET("/content/{key}/locales/{locale}", { params: { path: params } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentLocaleVersionsResponse
  }

  const deleteLocale = async (params: ContentLocaleParam): Promise<ContentDeleteLocaleResponse | void> => {
    const res = await client.DELETE("/content/{key}/locales/{locale}", { params: { path: params } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentDeleteLocaleResponse | void
  }

  const listAllVersions = async (params?: ContentListQueryParams): Promise<ContentAllVersionsResponse> => {
    const normalizedParams = params ? {
      ...params,
      statuses: params.statuses ? (Array.isArray(params.statuses) ? params.statuses : [params.statuses]) : undefined,
      locales: params.locales ? (Array.isArray(params.locales) ? params.locales : [params.locales]) : undefined,
    } : undefined
    const res = await client.GET("/content/versions", { params: { query: normalizedParams } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as ContentAllVersionsResponse
  }

  if (!params) {
    return {
      post: async (body: ContentCreateRequest) => await createContent(body),
      upload: async (body: ContentUploadRequest) => await uploadContent(body),
      list: async (params?: ContentListQueryParams) => await listAllVersions(params),
    }
  }

  if (isVersionParam(params)) {
    return {
      get: async () => await getVersion(params),
      patch: async (body: ContentPatchVersionRequest) => await patchVersion(params, body),
      delete: async () => await deleteVersion(params),
      media: async () => await getMedia(params),
      previews: async () => await getPreviews(params),
      workflow: () => ({
        ready: async () => await ready(params),
        approve: async () => await approve(params),
        reject: async () => await reject(params),
        publish: async () => await publish(params),
        draft: async () => await draft(params),
      }),
    }
  }

  if (isLocaleParam(params)) {
    return {
      list: async () => await listLocaleVersions(params),
      delete: async () => await deleteLocale(params),
    }
  }

  if (isKeyParam(params)) {
    const keyParam = params as ContentKeyParam
    return {
      get: async () => await getNode(keyParam),
      patch: async (body: ContentPatchNodeRequest) => await patchNode(keyParam, body),
      delete: async () => await deleteContent(keyParam),
      copy: async (options?: ContentCopyRequest) => await copyContent(keyParam, options),
      undelete: async () => await undeleteContent(keyParam),
      path: async () => await getPath(keyParam),
      assets: async () => await listAssets(keyParam),
      items: async () => await listItems(keyParam),
      versions: async () => await listVersions(keyParam),
      createVersion: async (body: any) => await createVersion(keyParam, body),
    }
  }

  throw new Error("Invalid parameters")
  }

  return content
}

export type iContent = ContentApi