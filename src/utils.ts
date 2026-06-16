

import type { ProblemDetails } from "./errorTypes.ts"

export const handleerror = (res: { error?: ProblemDetails }): string | undefined => {
    if (!res.error) return undefined

    const error = res.error
    const code = error.code ?? error.type ?? String(error.status ?? "unknown")
    const detail = error.detail ?? (error.errors?.length ? JSON.stringify(error.errors, null, 2) : "No detail provided")

    return [
        `title:    ${error.title ?? "Unknown"}`,
        `code:     ${code}`,
        `detail:   ${detail}`,
        `instance: ${error.instance ?? "Unknown"}`,
        `status:   ${error.status ?? "Unknown"}`,
    ].join("\n")
}

/**
 * @name keyFromEntryPoint
 * @description helper to get the key element from a CMS entrypoint
 * @param entryPoint entrypoint url as returned from CMS
 * @returns the key of the entrypoint
 */
export const keyFromEntryPoint = (entryPoint: string): string => entryPoint.replace("cms://content/", "")