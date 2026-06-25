import type { TypedSdkClient } from "./openapi/typedsdk.ts"
import type { paths } from "../generated/openapispec.ts"
import { handleerror } from "./utils.ts"
import { entityLogger } from "./logger/logging.ts"

// Entity-level logger scoped to this resource.
const log = entityLogger.getChild("bindings")

type BindingListResponse = paths["/contenttypebindings"]["get"]["responses"][200]["content"]["application/json"]
type BindingGetResponse = paths["/contenttypebindings/{key}"]["get"]["responses"][200]["content"]["application/json"]

type BindingCreateRequest = paths["/contenttypebindings"]["post"]["requestBody"]["content"]["application/json"]
type BindingCreateResponse = paths["/contenttypebindings"]["post"]["responses"][201]["content"]["application/json"]

type BindingPatchRequest = paths["/contenttypebindings/{key}"]["patch"]["requestBody"]["content"]["application/merge-patch+json"]
type BindingPatchResponse = paths["/contenttypebindings/{key}"]["patch"]["responses"][200]["content"]["application/json"]

type BindingDeleteResponse = paths["/contenttypebindings/{key}"]["delete"]["responses"][200]["content"]["application/json"]

export type BindingKeyParam = { key: string }
export type BindingQueryParam = { pageIndex?: number; pageSize?: number }

export interface BindingsApi {
  (): {
    /**
     * List content type bindings.
     *
     * @param query - Optional pagination parameters
     * @returns Promise resolving to the paginated binding list
     * @throws Error on 401, 403, 429, 500, or other failures
     */
    list: (query?: BindingQueryParam) => Promise<BindingListResponse>

    /**
     * Creates a new content type binding.
     *
     * @param body - Binding data to create
     * @returns Promise resolving to the created binding
     * @throws Error on 400, 401, 403, 409, 429, 500
     */
    post: (body: BindingCreateRequest) => Promise<BindingCreateResponse>
  }
  (key: BindingKeyParam): {
    /**
     * Retrieves a specific content type binding by key.
     *
     * @returns Promise resolving to the binding data
     * @throws Error if not found (404) or request fails
     */
    get: () => Promise<BindingGetResponse>

    /**
     * Partially updates a binding using JSON Merge Patch.
     *
     * @param body - Fields to update (all optional)
     * @returns Promise resolving to the updated binding
     * @throws Error if not found (404), precondition fails (412), or validation fails
     */
    patch: (body: BindingPatchRequest) => Promise<BindingPatchResponse>

    /**
     * Deletes a content type binding. This operation cannot be undone.
     *
     * @returns Promise resolving to deletion confirmation or void
     * @throws Error if not found (404) or deletion fails
     */
    delete: () => Promise<BindingDeleteResponse | void>
  }
}

export function createBindings(client: TypedSdkClient): BindingsApi {
  // Collection-level operations
  function bindings(): {
    list: (query?: BindingQueryParam) => Promise<BindingListResponse>

    post: (body: BindingCreateRequest) => Promise<BindingCreateResponse>
  }

  // Item-level operations
  function bindings(key: BindingKeyParam): {
    get: () => Promise<BindingGetResponse>

    patch: (body: BindingPatchRequest) => Promise<BindingPatchResponse>

    delete: () => Promise<BindingDeleteResponse | void>
  }

  // Implementation with optional parameter
  function bindings(key?: BindingKeyParam) {
    const listBindings = async (query?: BindingQueryParam): Promise<BindingListResponse> => {
      log.debug("Listing bindings", { query })
      const res = await client.GET("/contenttypebindings", { params: { query } })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to list binding: {error}", { error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as BindingListResponse
    }

    const getBinding = async (keyParam: BindingKeyParam): Promise<BindingGetResponse> => {
      log.debug("Fetching binding {key}", { key: keyParam.key })
      const res = await client.GET("/contenttypebindings/{key}", { params: { path: keyParam } })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to fetch binding {key}: {error}", { key: keyParam.key, error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as BindingGetResponse
    }

    const createBinding = async (body: BindingCreateRequest): Promise<BindingCreateResponse> => {
      log.info("Creating binding")
      const res = await client.POST("/contenttypebindings", { body })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to create binding: {error}", { error: errorMessage })
        throw new Error(errorMessage)
      }
      log.info("Created binding {key}", { key: (res.data as BindingCreateResponse)?.key })
      return res.data as BindingCreateResponse
    }

    const patchBinding = async (keyParam: BindingKeyParam, body: BindingPatchRequest): Promise<BindingPatchResponse> => {
      log.info("Patching binding {key}", { key: keyParam.key })
      const res = await client.PATCH("/contenttypebindings/{key}", { params: { path: keyParam },headers: {"content-type": "application/merge-patch+json"}, body })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to patch binding {key}: {error}", { key: keyParam.key, error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as BindingPatchResponse
    }

    const deleteBinding = async (keyParam: BindingKeyParam): Promise<BindingDeleteResponse | void> => {
      log.info("Deleting binding {key}", { key: keyParam.key })
      const res = await client.DELETE("/contenttypebindings/{key}", { params: { path: keyParam } })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to delete binding {key}: {error}", { key: keyParam.key, error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as BindingDeleteResponse | void
    }

    if (key) {
      return {
        get: async () => await getBinding(key),
        patch: async (body: BindingPatchRequest) => await patchBinding(key, body),
        delete: async () => await deleteBinding(key),
      }
    }

    return {
      list: async (query?: BindingQueryParam) => await listBindings(query),
      post: async (body: BindingCreateRequest) => await createBinding(body),
    }
  }

  return bindings
}

export type iBindings = BindingsApi