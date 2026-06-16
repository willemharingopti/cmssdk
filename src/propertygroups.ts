import type { TypedSdkClient } from "./openapi/typedsdk.ts"
import type { paths } from "../generated/openapispec.ts"
import { handleerror } from "./utils.ts"

type PropertyGroupListResponse = paths["/propertygroups"]["get"]["responses"][200]["content"]["application/json"]
type PropertyGroupGetResponse = paths["/propertygroups/{key}"]["get"]["responses"][200]["content"]["application/json"]

type PropertyGroupCreateRequest = paths["/propertygroups"]["post"]["requestBody"]["content"]["application/json"]
type PropertyGroupCreateResponse = paths["/propertygroups"]["post"]["responses"][201]["content"]["application/json"]

type PropertyGroupPatchRequest = paths["/propertygroups/{key}"]["patch"]["requestBody"]["content"]["application/merge-patch+json"]
type PropertyGroupPatchResponse = paths["/propertygroups/{key}"]["patch"]["responses"][200]["content"]["application/json"]

type PropertyGroupDeleteResponse = paths["/propertygroups/{key}"]["delete"]["responses"][200]["content"]["application/json"]

export type PropertyGroupKeyParam = { key: string }
export type PropertyGroupQueryParam = {
  /**
   * Indicates which property group sources should be listed.
   * Use 'DEFAULT' to include groups without a specific source.
   */
  sources?: string[]
}

export interface PropertyGroupsApi {
  (): {
    list: (query?: PropertyGroupQueryParam) => Promise<PropertyGroupListResponse>
    post: (body: PropertyGroupCreateRequest) => Promise<PropertyGroupCreateResponse>
  }
  (key: PropertyGroupKeyParam): {
    get: () => Promise<PropertyGroupGetResponse>
    patch: (body: PropertyGroupPatchRequest) => Promise<PropertyGroupPatchResponse>
    delete: () => Promise<PropertyGroupDeleteResponse | void>
  }
}

export function createPropertyGroups(client: TypedSdkClient): PropertyGroupsApi {
  // Collection-level operations
  function propertygroups(): {
    /**
     * List property groups.
     *
     * @param query - Optional source filter
     * @returns Promise resolving to the property group list
     * @throws Error on 401, 403, 429, 500, or other failures
     */
    list: (query?: PropertyGroupQueryParam) => Promise<PropertyGroupListResponse>

    /**
     * Creates a new property group.
     *
     * @param body - Property group data to create
     * @returns Promise resolving to the created property group
     * @throws Error on 400, 401, 403, 409, 429, 500
     */
    post: (body: PropertyGroupCreateRequest) => Promise<PropertyGroupCreateResponse>
  }

  // Item-level operations
  function propertygroups(key: PropertyGroupKeyParam): {
    /**
     * Retrieves a specific property group by key.
     *
     * @returns Promise resolving to the property group data
     * @throws Error if not found (404) or request fails
     */
    get: () => Promise<PropertyGroupGetResponse>

    /**
     * Partially updates a property group using JSON Merge Patch.
     *
     * @param body - Fields to update (all optional)
     * @returns Promise resolving to the updated property group
     * @throws Error if not found (404), precondition fails (412), or validation fails
     */
    patch: (body: PropertyGroupPatchRequest) => Promise<PropertyGroupPatchResponse>

    /**
     * Deletes a property group. This operation cannot be undone.
     *
     * @returns Promise resolving to deletion confirmation or void
     * @throws Error if not found (404) or deletion fails
     */
    delete: () => Promise<PropertyGroupDeleteResponse | void>
  }

  // Implementation with optional parameter
  function propertygroups(key?: PropertyGroupKeyParam) {
    const listPropertyGroups = async (query?: PropertyGroupQueryParam): Promise<PropertyGroupListResponse> => {
      const res = await client.GET("/propertygroups", { params: { query } })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as PropertyGroupListResponse
    }

    const getPropertyGroup = async (keyParam: PropertyGroupKeyParam): Promise<PropertyGroupGetResponse> => {
      const res = await client.GET("/propertygroups/{key}", { params: { path: keyParam } })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as PropertyGroupGetResponse
    }

    const createPropertyGroup = async (body: PropertyGroupCreateRequest): Promise<PropertyGroupCreateResponse> => {
      const res = await client.POST("/propertygroups", { body })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as PropertyGroupCreateResponse
    }

    const patchPropertyGroup = async (keyParam: PropertyGroupKeyParam, body: PropertyGroupPatchRequest): Promise<PropertyGroupPatchResponse> => {
      const res = await client.PATCH("/propertygroups/{key}", { params: { path: keyParam }, body })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as PropertyGroupPatchResponse
    }

    const deletePropertyGroup = async (keyParam: PropertyGroupKeyParam): Promise<PropertyGroupDeleteResponse | void> => {
      const res = await client.DELETE("/propertygroups/{key}", { params: { path: keyParam } })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as PropertyGroupDeleteResponse | void
    }

    if (key) {
      return {
        get: async () => await getPropertyGroup(key),
        patch: async (body: PropertyGroupPatchRequest) => await patchPropertyGroup(key, body),
        delete: async () => await deletePropertyGroup(key),
      }
    }

    return {
      list: async (query?: PropertyGroupQueryParam) => await listPropertyGroups(query),
      post: async (body: PropertyGroupCreateRequest) => await createPropertyGroup(body),
    }
  }

  return propertygroups
}
