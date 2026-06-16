import * as dotenv from "dotenv"
import { createApplications } from "./applications.ts"
import { createBlueprints } from "./blueprints.ts"
import { createContent } from "./content.ts"
import { createContentTypes } from "./contenttypes.ts"
import { createSources } from "./sources.ts"
import { createBindings } from "./bindings.ts"
import { createDisplayTemplates } from "./displaytemplates.ts"
import { createLocales } from "./locales.ts"
import { createManifest } from "./manifest.ts"
import { createPropertyFormats } from "./propertyformats.ts"
import { createPropertyGroups } from "./propertygroups.ts"
import { typedsdk, type iOptions } from "./openapi/typedsdk.ts"
export { keyFromEntryPoint } from "./utils.ts"
export type { iOptions } from "./openapi/typedsdk.ts"

dotenv.config()

export interface CmsSdkInstance {
    applications: ReturnType<typeof createApplications>;
    blueprints: ReturnType<typeof createBlueprints>;
    contenttypes: ReturnType<typeof createContentTypes>;
    content: ReturnType<typeof createContent>;
    sources: ReturnType<typeof createSources>;
    bindings: ReturnType<typeof createBindings>;
    displaytemplates: ReturnType<typeof createDisplayTemplates>;
    locales: ReturnType<typeof createLocales>;
    manifest: ReturnType<typeof createManifest>;
    propertyformats: ReturnType<typeof createPropertyFormats>;
    propertygroups: ReturnType<typeof createPropertyGroups>;
}

/**
   * main entry point of the application
   *
   * @param options - Optional credentials/base URL. When omitted, values are read
   *   from the OPTIMIZELY_CMS_* environment variables and a shared client (with a
   *   cached OAuth token) is reused. When provided, a dedicated client is created
   *   so multiple instances can use different credentials independently.
*/
export const cmssdk = (options?: iOptions): CmsSdkInstance => {
    // Resolve credentials here so createTypedSdk always receives a fully-formed
    // options object and never has to reach into the environment itself.
    const resolved: iOptions = {
        client_id: options?.client_id || process.env.OPTIMIZELY_CMS_CLIENT_ID,
        client_secret: options?.client_secret || process.env.OPTIMIZELY_CMS_CLIENT_SECRET,
        base_url: options?.base_url || process.env.OPTIMIZELY_CMS_BASE_URL,
        debug: options?.debug,
    }

    if (!resolved.client_id) throw new Error("Missing required environment variables: OPTIMIZELY_CMS_CLIENT_ID")
    if (!resolved.client_secret) throw new Error("Missing required environment variables: OPTIMIZELY_CMS_CLIENT_SECRET")
    if (!resolved.base_url) throw new Error("Missing required environment variables: OPTIMIZELY_CMS_BASE_URL")

    // No explicit options means use the shared, token-caching client.
    const client = typedsdk(resolved, !options)
    return {
        applications: createApplications(client),
        blueprints: createBlueprints(client),
        contenttypes: createContentTypes(client),
        content: createContent(client),
        sources: createSources(client),
        bindings: createBindings(client),
        displaytemplates: createDisplayTemplates(client),
        locales: createLocales(client),
        manifest: createManifest(client),
        propertyformats: createPropertyFormats(client),
        propertygroups: createPropertyGroups(client)
    }
}
