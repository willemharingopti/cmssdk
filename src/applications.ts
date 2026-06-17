import type { TypedSdkClient } from "./openapi/typedsdk.ts"
import type { paths } from "../generated/openapispec.ts"
import { handleerror } from "./utils.ts"

type ApplicationsListResponse = paths["/applications"]["get"]["responses"][200]["content"]["application/json"]
type ApplicationGetResponse = paths["/applications/{key}"]["get"]["responses"][200]["content"]["application/json"]

type RawApplicationCreate = paths["/applications"]["post"]["requestBody"]["content"]["application/json"]
type ApplicationPatchRequest = paths["/applications/{key}"]["patch"]["requestBody"]["content"]["application/merge-patch+json"]
type ApplicationPatchResponse = paths["/applications/{key}"]["patch"]["responses"][200]["content"]["application/json"]
type ApplicationDeleteResponse = paths["/applications/{key}"]["delete"]["responses"][200]["content"]["application/json"]

export const APPLICATION_TYPE_KEYS = ["website", "remote"] as const
export type ApplicationTypeKey = typeof APPLICATION_TYPE_KEYS[number]
export type ApplicationKeyParam = { key: string }
export type ApplicationQueryParam = { pageIndex?: number, pageSize?: number}

// Allow passing one or more application type keys in `type`, or the original ApplicationType shape.
type ApplicationCreateRequest = Omit<RawApplicationCreate, "type"> & {
    /**
     * Supported application type keys. Use one or more of the values in APPLICATION_TYPE_KEYS.
     */
    type?: ApplicationTypeKey | ApplicationTypeKey[] | RawApplicationCreate["type"]
}

type ApplicationCreateResponse = paths["/applications"]["post"]["responses"][201]["content"]["application/json"]


export interface ApplicationsApi {
  (): {
    /**
     * List applications.
     *
     * List all applications available in the CMS.
     *
     * @param query - Optional pagination parameters
     * @returns Promise resolving to the paginated application list
     * @throws Error on 401, 403, 429, 500, or other failures
     */
    list: (query?: ApplicationQueryParam) => Promise<ApplicationsListResponse>

    /**
     * Create application.
     *
     * Create a new application.
     *
     * @param body - Application data to create
     * @returns Promise resolving to the created application
     * @throws Error on 400, 401, 403, 409, 429, 500
     */
    post: (body: ApplicationCreateRequest) => Promise<ApplicationCreateResponse>
  }
  (key: ApplicationKeyParam): {
    /**
     * Get application.
     *
     * Get the application with the provided key.
     *
     * @returns Promise resolving to the application data
     * @throws Error if not found (404) or request fails
     */
    get: () => Promise<ApplicationGetResponse>

    /**
     * Delete application.
     *
     * Deletes the application with the provided key. This operation cannot be undone.
     *
     * @returns Promise resolving to deletion confirmation or void
     * @throws Error if not found (404) or deletion fails
     */
    delete: () => Promise<ApplicationDeleteResponse | void>

    /**
     * Patch application.
     *
     * Patch an existing application using JSON Merge Patch.
     *
     * @param body - Fields to update (all optional)
     * @returns Promise resolving to the updated application
     * @throws Error if not found (404), precondition fails (412), or validation fails
     */
    patch: (body: ApplicationPatchRequest) => Promise<ApplicationPatchResponse>
  }
}

export function createApplications(client: TypedSdkClient): ApplicationsApi {
  // Collection-level operations
  function applications(): {
    list: (query?: ApplicationQueryParam) => Promise<ApplicationsListResponse>

    post: (body: ApplicationCreateRequest) => Promise<ApplicationCreateResponse>
  }

  // Item-level operations
  function applications(key: ApplicationKeyParam): {
    get: () => Promise<ApplicationGetResponse>

    delete: () => Promise<ApplicationDeleteResponse | void>

    patch: (body: ApplicationPatchRequest) => Promise<ApplicationPatchResponse>
  }

  function applications(key?: ApplicationKeyParam) {
    const listApplications = async (query?: ApplicationQueryParam): Promise<ApplicationsListResponse> => {
        const res = await client.GET("/applications", {params: {query: query}})
        const errorMessage = handleerror(res)
        if (errorMessage) throw new Error(errorMessage)
        return res.data as ApplicationsListResponse
    }

    const getApplication = async (keyParam: ApplicationKeyParam): Promise<ApplicationGetResponse> => {
        const res = await client.GET(`/applications/{key}`, { params: { path: keyParam } })
        const errorMessage = handleerror(res)
        if (errorMessage) throw new Error(errorMessage)
        return res.data as ApplicationGetResponse
    }

    const deleteApplication = async (keyParam: ApplicationKeyParam): Promise<ApplicationDeleteResponse | void> => {
        const res = await client.DELETE(`/applications/{key}`, { params: { path: keyParam } })
        const errorMessage = handleerror(res)
        if (errorMessage) throw new Error(errorMessage)
        return res.data as ApplicationDeleteResponse | void
    }

    const patchApplication = async (keyParam: ApplicationKeyParam, body: ApplicationPatchRequest): Promise<ApplicationPatchResponse> => {
        const res = await client.PATCH(`/applications/{key}`, { params: { path: keyParam }, body })
        const errorMessage = handleerror(res)
        if (errorMessage) throw new Error(errorMessage)
        return res.data as ApplicationPatchResponse
    }

    const createApplication = async (body: ApplicationCreateRequest): Promise<ApplicationCreateResponse> => {
        const res = await client.POST("/applications", { body: body as unknown as RawApplicationCreate })
        const errorMessage = handleerror(res)
        if (errorMessage) throw new Error(errorMessage)
        return res.data as ApplicationCreateResponse
    }

    if (key) {
        return {
            get: async () => await getApplication(key),
            delete: async () => await deleteApplication(key),
            patch: async (body: ApplicationPatchRequest) => await patchApplication(key, body),
        }
    }

    return {
        list: async (query?: ApplicationQueryParam) => await listApplications(query),
        post: async (body: ApplicationCreateRequest) => await createApplication(body),
    }
  }

  return applications
}

export type iApplication = ApplicationsApi
