import type { TypedSdkClient } from "./openapi/typedsdk.ts"
import type { paths } from "../generated/openapispec.ts"
import { handleerror } from "./utils.ts"
import { entityLogger } from "./logger/logging.ts"

// Entity-level logger scoped to this resource.
const log = entityLogger.getChild("locales")

type LocaleListResponse = paths["/locales"]["get"]["responses"][200]["content"]["application/json"]
type LocaleGetResponse = paths["/locales/{key}"]["get"]["responses"][200]["content"]["application/json"]

type LocaleCreateRequest = paths["/locales"]["post"]["requestBody"]["content"]["application/json"]
type LocaleCreateResponse = paths["/locales"]["post"]["responses"][201]["content"]["application/json"]

type LocalePatchRequest = paths["/locales/{key}"]["patch"]["requestBody"]["content"]["application/merge-patch+json"]
type LocalePatchResponse = paths["/locales/{key}"]["patch"]["responses"][200]["content"]["application/json"]

type LocaleDeleteResponse = paths["/locales/{key}"]["delete"]["responses"][200]["content"]["application/json"]

export type LocaleKeyParam = { key: string }
export type LocaleQueryParam = { pageIndex?: number; pageSize?: number }

export interface LocalesApi {
  (): {
    /**
     * List locales.
     *
     * @param query - Optional pagination parameters
     * @returns Promise resolving to the paginated locale list
     * @throws Error on 401, 403, 429, 500, or other failures
     */
    list: (query?: LocaleQueryParam) => Promise<LocaleListResponse>

    /**
     * Creates a new locale.
     *
     * @param body - Locale data to create
     * @returns Promise resolving to the created locale
     * @throws Error on 400, 401, 403, 409, 429, 500
     */
    post: (body: LocaleCreateRequest) => Promise<LocaleCreateResponse>
  }
  (key: LocaleKeyParam): {
    /**
     * Retrieves a specific locale by key.
     *
     * @returns Promise resolving to the locale data
     * @throws Error if not found (404) or request fails
     */
    get: () => Promise<LocaleGetResponse>

    /**
     * Partially updates a locale using JSON Merge Patch.
     *
     * @param body - Fields to update (all optional)
     * @returns Promise resolving to the updated locale
     * @throws Error if not found (404), precondition fails (412), or validation fails
     */
    patch: (body: LocalePatchRequest) => Promise<LocalePatchResponse>

    /**
     * Deletes a locale. This operation cannot be undone.
     *
     * @returns Promise resolving to deletion confirmation or void
     * @throws Error if not found (404) or deletion fails
     */
    delete: () => Promise<LocaleDeleteResponse | void>
  }
}

export function createLocales(client: TypedSdkClient): LocalesApi {
  // Collection-level operations
  function locales(): {
    list: (query?: LocaleQueryParam) => Promise<LocaleListResponse>

    post: (body: LocaleCreateRequest) => Promise<LocaleCreateResponse>
  }

  // Item-level operations
  function locales(key: LocaleKeyParam): {
    get: () => Promise<LocaleGetResponse>

    patch: (body: LocalePatchRequest) => Promise<LocalePatchResponse>

    delete: () => Promise<LocaleDeleteResponse | void>
  }

  // Implementation with optional parameter
  function locales(key?: LocaleKeyParam) {
    const listLocales = async (query?: LocaleQueryParam): Promise<LocaleListResponse> => {
      log.debug("Listing locales", { query })
      const res = await client.GET("/locales", { params: { query } })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to list locale: {error}", { error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as LocaleListResponse
    }

    const getLocale = async (keyParam: LocaleKeyParam): Promise<LocaleGetResponse> => {
      log.debug("Fetching locale {key}", { key: keyParam.key })
      const res = await client.GET("/locales/{key}", { params: { path: keyParam } })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to fetch locale {key}: {error}", { key: keyParam.key, error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as LocaleGetResponse
    }

    const createLocale = async (body: LocaleCreateRequest): Promise<LocaleCreateResponse> => {
      log.info("Creating locale")
      const res = await client.POST("/locales", { body })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to create locale: {error}", { error: errorMessage })
        throw new Error(errorMessage)
      }
      log.info("Created locale {key}", { key: body.key })
      return res.data as LocaleCreateResponse
    }

    const patchLocale = async (keyParam: LocaleKeyParam, body: LocalePatchRequest): Promise<LocalePatchResponse> => {
      log.info("Patching locale {key}", { key: keyParam.key })
      const res = await client.PATCH("/locales/{key}", { params: { path: keyParam }, headers: {"content-type": "application/merge-patch+json"}, body })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to patch locale {key}: {error}", { key: keyParam.key, error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as LocalePatchResponse
    }

    const deleteLocale = async (keyParam: LocaleKeyParam): Promise<LocaleDeleteResponse | void> => {
      log.info("Deleting locale {key}", { key: keyParam.key })
      const res = await client.DELETE("/locales/{key}", { params: { path: keyParam } })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to delete locale {key}: {error}", { key: keyParam.key, error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as LocaleDeleteResponse | void
    }

    if (key) {
      return {
        get: async () => await getLocale(key),
        patch: async (body: LocalePatchRequest) => await patchLocale(key, body),
        delete: async () => await deleteLocale(key),
      }
    }

    return {
      list: async (query?: LocaleQueryParam) => await listLocales(query),
      post: async (body: LocaleCreateRequest) => await createLocale(body),
    }
  }

  return locales
}

export type iLocales = LocalesApi