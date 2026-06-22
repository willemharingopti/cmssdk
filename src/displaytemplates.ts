import type { TypedSdkClient } from "./openapi/typedsdk.ts"
import type { paths } from "../generated/openapispec.ts"
import { handleerror } from "./utils.ts"

type DisplayTemplateListResponse = paths["/displaytemplates"]["get"]["responses"][200]["content"]["application/json"]
type DisplayTemplateGetResponse = paths["/displaytemplates/{key}"]["get"]["responses"][200]["content"]["application/json"]

type DisplayTemplateCreateRequest = paths["/displaytemplates"]["post"]["requestBody"]["content"]["application/json"]
type DisplayTemplateCreateResponse = paths["/displaytemplates"]["post"]["responses"][201]["content"]["application/json"]

type DisplayTemplatePatchRequest = paths["/displaytemplates/{key}"]["patch"]["requestBody"]["content"]["application/merge-patch+json"]
type DisplayTemplatePatchResponse = paths["/displaytemplates/{key}"]["patch"]["responses"][200]["content"]["application/json"]

type DisplayTemplateDeleteResponse = paths["/displaytemplates/{key}"]["delete"]["responses"][200]["content"]["application/json"]

export type DisplayTemplateKeyParam = { key: string }
export type DisplayTemplateQueryParam = { pageIndex?: number; pageSize?: number }

export interface DisplayTemplatesApi {
  (): {
    /**
     * List display templates.
     *
     * @param query - Optional pagination parameters
     * @returns Promise resolving to the paginated display template list
     * @throws Error on 401, 403, 429, 500, or other failures
     */
    list: (query?: DisplayTemplateQueryParam) => Promise<DisplayTemplateListResponse>

    /**
     * Creates a new display template.
     *
     * @param body - Display template data to create
     * @returns Promise resolving to the created display template
     * @throws Error on 400, 401, 403, 409, 429, 500
     */
    post: (body: DisplayTemplateCreateRequest) => Promise<DisplayTemplateCreateResponse>
  }
  (key: DisplayTemplateKeyParam): {
    /**
     * Retrieves a specific display template by key.
     *
     * @returns Promise resolving to the display template data
     * @throws Error if not found (404) or request fails
     */
    get: () => Promise<DisplayTemplateGetResponse>

    /**
     * Partially updates a display template using JSON Merge Patch.
     *
     * @param body - Fields to update (all optional)
     * @returns Promise resolving to the updated display template
     * @throws Error if not found (404), precondition fails (412), or validation fails
     */
    patch: (body: DisplayTemplatePatchRequest) => Promise<DisplayTemplatePatchResponse>

    /**
     * Deletes a display template. This operation cannot be undone.
     *
     * @returns Promise resolving to deletion confirmation or void
     * @throws Error if not found (404) or deletion fails
     */
    delete: () => Promise<DisplayTemplateDeleteResponse | void>
  }
}

export function createDisplayTemplates(client: TypedSdkClient): DisplayTemplatesApi {
  // Collection-level operations
  function displaytemplates(): {
    list: (query?: DisplayTemplateQueryParam) => Promise<DisplayTemplateListResponse>

    post: (body: DisplayTemplateCreateRequest) => Promise<DisplayTemplateCreateResponse>
  }

  // Item-level operations
  function displaytemplates(key: DisplayTemplateKeyParam): {
    get: () => Promise<DisplayTemplateGetResponse>

    patch: (body: DisplayTemplatePatchRequest) => Promise<DisplayTemplatePatchResponse>

    delete: () => Promise<DisplayTemplateDeleteResponse | void>
  }

  // Implementation with optional parameter
  function displaytemplates(key?: DisplayTemplateKeyParam) {
    const listDisplayTemplates = async (query?: DisplayTemplateQueryParam): Promise<DisplayTemplateListResponse> => {
      const res = await client.GET("/displaytemplates", { params: { query } })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as DisplayTemplateListResponse
    }

    const getDisplayTemplate = async (keyParam: DisplayTemplateKeyParam): Promise<DisplayTemplateGetResponse> => {
      const res = await client.GET("/displaytemplates/{key}", { params: { path: keyParam } })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as DisplayTemplateGetResponse
    }

    const createDisplayTemplate = async (body: DisplayTemplateCreateRequest): Promise<DisplayTemplateCreateResponse> => {
      const res = await client.POST("/displaytemplates", { body })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as DisplayTemplateCreateResponse
    }

    const patchDisplayTemplate = async (keyParam: DisplayTemplateKeyParam, body: DisplayTemplatePatchRequest): Promise<DisplayTemplatePatchResponse> => {
      const res = await client.PATCH("/displaytemplates/{key}", { params: { path: keyParam }, headers: {"content-type": "application/merge-patch+json"}, body })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as DisplayTemplatePatchResponse
    }

    const deleteDisplayTemplate = async (keyParam: DisplayTemplateKeyParam): Promise<DisplayTemplateDeleteResponse | void> => {
      const res = await client.DELETE("/displaytemplates/{key}", { params: { path: keyParam } })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as DisplayTemplateDeleteResponse | void
    }

    if (key) {
      return {
        get: async () => await getDisplayTemplate(key),
        patch: async (body: DisplayTemplatePatchRequest) => await patchDisplayTemplate(key, body),
        delete: async () => await deleteDisplayTemplate(key),
      }
    }

    return {
      list: async (query?: DisplayTemplateQueryParam) => await listDisplayTemplates(query),
      post: async (body: DisplayTemplateCreateRequest) => await createDisplayTemplate(body),
    }
  }

  return displaytemplates
}

export type iDisplayTemplates = DisplayTemplatesApi