import type { components } from "../generated/openapispec.ts"

export type ProblemDetails = components["schemas"]["ProblemDetails"]

export type ProblemDetailItem = NonNullable<ProblemDetails["errors"]>[number]

export type ErrorResponseContent = ProblemDetails

export type ErrorResponses = {
    BadRequest: components["responses"]["BadRequest"]["content"]["application/problem+json"]
    Unauthorized: components["responses"]["Unauthorized"]["content"]["application/problem+json"]
    Forbidden: components["responses"]["Forbidden"]["content"]["application/problem+json"]
    NotFound: components["responses"]["NotFound"]["content"]["application/problem+json"]
    Conflict: components["responses"]["Conflict"]["content"]["application/problem+json"]
}

export default ProblemDetails
