import type { TypedSdkClient } from "./openapi/typedsdk.ts"
import type { paths } from "../generated/openapispec.ts"
import { handleerror } from "./utils.ts"
import { entityLogger } from "./logger/logging.ts"

// Entity-level logger scoped to this resource.
const log = entityLogger.getChild("propertyformats")

type PropertyFormatListResponse = paths["/propertyformats"]["get"]["responses"][200]["content"]["application/json"]
type PropertyFormatGetResponse = paths["/propertyformats/{key}"]["get"]["responses"][200]["content"]["application/json"]

export type PropertyFormatKeyParam = { key: string }
export type PropertyFormatQueryParam = { pageIndex?: number; pageSize?: number }
export type PropertyFormatGetQueryParam = {
  /** Indicates that a deleted property format may be returned. */
  allowDeleted?: boolean
}

export interface PropertyFormatsApi {
  (): {
    /**
     * List property formats.
     *
     * @param query - Optional pagination parameters
     * @returns Promise resolving to the paginated property format list
     * @throws Error on 401, 403, 429, 500, or other failures
     */
    list: (query?: PropertyFormatQueryParam) => Promise<PropertyFormatListResponse>
  }
  (key: PropertyFormatKeyParam): {
    /**
     * Retrieves a specific property format by key.
     *
     * @param query - Optional flags (e.g. allowDeleted)
     * @returns Promise resolving to the property format data (no body on 304 Not Modified)
     * @throws Error if not found (404) or request fails
     */
    get: (query?: PropertyFormatGetQueryParam) => Promise<PropertyFormatGetResponse>
  }
}

// Property formats are a read-only, built-in resource: only list and get are supported.
export function createPropertyFormats(client: TypedSdkClient): PropertyFormatsApi {
  // Collection-level operations
  function propertyformats(): {
    list: (query?: PropertyFormatQueryParam) => Promise<PropertyFormatListResponse>
  }

  // Item-level operations
  function propertyformats(key: PropertyFormatKeyParam): {
    get: (query?: PropertyFormatGetQueryParam) => Promise<PropertyFormatGetResponse>
  }

  // Implementation with optional parameter
  function propertyformats(key?: PropertyFormatKeyParam) {
    const listPropertyFormats = async (query?: PropertyFormatQueryParam): Promise<PropertyFormatListResponse> => {
      log.debug("Listing property formats", { query })
      const res = await client.GET("/propertyformats", { params: { query } })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to list property format: {error}", { error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as PropertyFormatListResponse
    }

    const getPropertyFormat = async (keyParam: PropertyFormatKeyParam, query?: PropertyFormatGetQueryParam): Promise<PropertyFormatGetResponse> => {
      log.debug("Fetching property format {key}", { key: keyParam.key })
      const res = await client.GET("/propertyformats/{key}", { params: { path: keyParam, query } })
      const errorMessage = handleerror(res)
      if (errorMessage) {
        log.error("Failed to fetch property format: {error}", { error: errorMessage })
        throw new Error(errorMessage)
      }
      return res.data as PropertyFormatGetResponse
    }

    if (key) {
      return {
        get: async (query?: PropertyFormatGetQueryParam) => await getPropertyFormat(key, query),
      }
    }

    return {
      list: async (query?: PropertyFormatQueryParam) => await listPropertyFormats(query),
    }
  }

  return propertyformats
}

export type iPropertyFormats = PropertyFormatsApi