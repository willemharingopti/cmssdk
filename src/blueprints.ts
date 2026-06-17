import type { TypedSdkClient } from "./openapi/typedsdk.ts"
import type { paths } from "../generated/openapispec.ts"
import { handleerror } from "./utils.ts"

type BlueprintListResponse = paths["/blueprints"]["get"]["responses"][200]["content"]["application/json"]
type BlueprintGetResponse = paths["/blueprints/{key}"]["get"]["responses"][200]["content"]["application/json"]

type RawBlueprintCreate = paths["/blueprints"]["post"]["requestBody"]["content"]["application/json"]
type BlueprintCreateResponse = paths["/blueprints"]["post"]["responses"][201]["content"]["application/json"]

type BlueprintPatchRequest = paths["/blueprints/{key}"]["patch"]["requestBody"]["content"]["application/merge-patch+json"]
type BlueprintPatchResponse = paths["/blueprints/{key}"]["patch"]["responses"][200]["content"]["application/json"]

type BlueprintDeleteResponse = paths["/blueprints/{key}"]["delete"]["responses"][200]["content"]["application/json"]

export type BlueprintKeyParam = { key: string }
export type BlueprintQueryParam = { pageIndex?: number; pageSize?: number }

// Allow passing contentType as a string reference to a ContentType key for better hinting
type BlueprintCreateRequest = Omit<RawBlueprintCreate, "contentType"> & {
  /**
   * Reference to the ContentType key for this blueprint.
   * Use the key of an existing ContentType resource.
   */
  contentType: string | RawBlueprintCreate["contentType"]
}

export interface BlueprintsApi {
  (): {
    /**
     * List blueprints.
     *
     * Retrieves a paginated list of all available blueprints. Results are sorted by creation date.
     *
     * @param query - Optional query parameters for pagination
     * @param query.pageIndex - Zero-based page index
     * @param query.pageSize - Number of results per page
     * @returns Promise resolving to paginated blueprint list
     * @throws Error on 401 (Unauthorized), 403 (Forbidden), 429 (TooManyRequests), 500 (Server error), or other failures
     *
     * @example
     * const blueprints = await blueprints().list()
     * const page2 = await blueprints().list({ pageIndex: 1, pageSize: 50 })
     */
    list: (query?: BlueprintQueryParam) => Promise<BlueprintListResponse>
    /**
     * Creates a new blueprint.
     *
     * @param body - Blueprint data to create
     * @returns Promise resolving to the created blueprint with assigned key
     * @throws Error on 400 (Bad request), 401 (Unauthorized), 403 (Forbidden), 409 (Conflict), 429 (TooManyRequests), 500 (Server error)
     *
     * @example
     * const newBlueprint = await blueprints().post({
     *   name: "My Blueprint",
     *   description: "A test blueprint"
     * })
     */
    post: (body: BlueprintCreateRequest) => Promise<BlueprintCreateResponse>
  }
  (key: BlueprintKeyParam): {
    /**
     * Retrieves a specific blueprint by key.
     *
     * @returns Promise resolving to the blueprint data
     * @throws Error if the blueprint is not found (404) or request fails
     *
     * @example
     * const blueprint = await blueprints({ key: "abc-123" }).get()
     */
    get: () => Promise<BlueprintGetResponse>
    /**
     * Partially updates a blueprint using JSON Merge Patch.
     *
     * Only provided fields are updated; omitted fields are unchanged.
     *
     * @param body - Fields to update (all fields optional)
     * @returns Promise resolving to the updated blueprint
     * @throws Error if the blueprint is not found (404), precondition fails (412), or validation fails
     *
     * @example
     * const updated = await blueprints({ key: "abc-123" }).patch({
     *   name: "Updated Blueprint"
     * })
     */
    patch: (body: BlueprintPatchRequest) => Promise<BlueprintPatchResponse>
    /**
     * Deletes a blueprint.
     *
     * This operation cannot be undone.
     *
     * @returns Promise resolving to deletion confirmation or void
     * @throws Error if the blueprint is not found (404) or deletion fails
     *
     * @example
     * await blueprints({ key: "abc-123" }).delete()
     */
    delete: () => Promise<BlueprintDeleteResponse | void>
  }
}

export function createBlueprints(client: TypedSdkClient): BlueprintsApi {
  // Collection-level operations
  function blueprints(): {
  list: (query?: BlueprintQueryParam) => Promise<BlueprintListResponse>

  post: (body: BlueprintCreateRequest) => Promise<BlueprintCreateResponse>
}

  // Item-level operations
  function blueprints(key: BlueprintKeyParam): {
  get: () => Promise<BlueprintGetResponse>

  patch: (body: BlueprintPatchRequest) => Promise<BlueprintPatchResponse>

  delete: () => Promise<BlueprintDeleteResponse | void>
}

  // Implementation with optional parameter
  function blueprints(key?: BlueprintKeyParam) {
  const listBlueprints = async (query?: BlueprintQueryParam): Promise<BlueprintListResponse> => {
    const res = await client.GET("/blueprints", { params: { query } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as BlueprintListResponse
  }

  const getBlueprint = async (keyParam: BlueprintKeyParam): Promise<BlueprintGetResponse> => {
    const res = await client.GET("/blueprints/{key}", { params: { path: keyParam } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as BlueprintGetResponse
  }

  const createBlueprint = async (body: BlueprintCreateRequest): Promise<BlueprintCreateResponse> => {
    const res = await client.POST("/blueprints", { body: body as unknown as RawBlueprintCreate })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as BlueprintCreateResponse
  }

  const patchBlueprint = async (keyParam: BlueprintKeyParam, body: BlueprintPatchRequest): Promise<BlueprintPatchResponse> => {
    const res = await client.PATCH("/blueprints/{key}", { params: { path: keyParam }, body })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as BlueprintPatchResponse
  }

  const deleteBlueprint = async (keyParam: BlueprintKeyParam): Promise<BlueprintDeleteResponse | void> => {
    const res = await client.DELETE("/blueprints/{key}", { params: { path: keyParam } })
    const errorMessage = handleerror(res)
    if (errorMessage) throw new Error(errorMessage)
    return res.data as BlueprintDeleteResponse | void
  }

  if (key) {
    return {
      get: async () => await getBlueprint(key),
      patch: async (body: BlueprintPatchRequest) => await patchBlueprint(key, body),
      delete: async () => await deleteBlueprint(key),
    }
  }

  return {
    list: async (query?: BlueprintQueryParam) => await listBlueprints(query),
    post: async (body: BlueprintCreateRequest) => await createBlueprint(body),
  }
  }

  return blueprints
}

export type iBlueprints = BlueprintsApi