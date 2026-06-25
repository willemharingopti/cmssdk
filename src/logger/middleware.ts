/**
 * openapi-fetch middleware that captures the api-level HTTP traffic.
 *
 * Each request/response is emitted at two levels so the threshold picks the
 * verbosity (see `apiLevel` in {@link configureLogging}):
 *
 *   - trace: the full Request / Response objects (headers, body, the lot)
 *   - debug: just the method + URL (and status on the response)
 *
 * Nothing is written until a sink is configured via {@link configureLogging}.
 */

import type { Middleware } from "openapi-fetch"
import { apiLogger } from "./logging.ts"

export const loggerMiddleware: Middleware = {
   onRequest({ request }) {
      apiLogger.debug("→ {method} {url}", { method: request.method, url: request.url })
      apiLogger.trace("→ request {request}", { request })
      return request
   },
   onResponse({ response }) {
      apiLogger.debug("← {status} {url}", { status: response.status, url: response.url })
      apiLogger.trace("← response {response}", { response })
      return response
   },
}
