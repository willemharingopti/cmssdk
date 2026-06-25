/**
 * main
 */

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
import { configureLogging } from "./logger/logging.ts"

import type {
    iApplication, iBlueprints, iContent, iContentTypes,
    iSources, iBindings, iDisplayTemplates, iLocales,
    iManifest, iPropertyFormats, iPropertyGroups
} from "./entityTypes.ts"

export { keyFromEntryPoint } from "./utils.ts"
export type { iOptions } from "./openapi/typedsdk.ts"
export { apiLogger, configureLogging, entityLogger, type LoggingOptions } from "./logger/logging.ts"

dotenv.config({quiet: true})

/**
 * These are the main methods of the sdk
 */
export interface CmsSdkInstance {
    /** In Optimizely Content Management System (CMS), an application represents any website or frontend that runs on the CMS instance. Examples include a website, a headless frontend, and a campaign microsite. Use Applications to configure and manage one or more applications, including preview settings, hostnames, and routing roots. */
    applications: iApplication;
    /** Blueprints are reusable layout templates used with Visual Builder to create content directly in the UI. Save sections and experiences as blueprints: a campaign landing page, a contest entry form, a masthead or hero image, or column and grid content. */
    blueprints: iBlueprints;
    /** Content types give editors a structured way to create and manage specific kinds of content. */
    contenttypes: iContentTypes;
    /** Content in Optimizely Content Management System (CMS) 13 can be pages, blocks, media files, and folders. It can also be catalog content in Optimizely Commerce Connect. In the Optimizely content model, a content type inherits from the Content interface and includes specific properties. */
    content: iContent;
    /** By registering a content source with CMS, editors can reference data from another source within CMS content. A developer building the frontend application can then consume the Graph URIs indexed within CMS data to fetch additional data from other content sources in Graph. */
    sources: iSources;
    /** A content type binding defines a set of property mappings from one content type to another. The from field specifies the source content type, and the to field specifies the target content type. After you define a content type binding, you can use it to data bind mapped properties from one content instance to another content instance. For example, you can bind a StartPage content type to a StartPageTeaser content type so that properties like an image, alt text, and body are automatically mapped between them. */
    bindings: iBindings;
    /** Display Templates are the components that define how a specific piece of content should be rendered or styled in a given context. Think of it this way: if a Content Type defines the data (the fields like "Headline" and "Image"), the Display Template defines the presentation (the HTML structure, CSS classes, and visual style). */
    displaytemplates: iDisplayTemplates;
    /** Editors can create content in a language after you activate it and set an access level for a language to authorize editors to create or edit pages in that language.

When an editor copies a page, language versions are copied regardless of the editor's language rights. This means that if an editor with access rights to English only copies a page that exists in English and French and pastes that somewhere, both language versions are copied. */
    locales: iLocales;
    /** A Content Manifest is a structured JSON document that serves as the "source of truth" for all your content definitions. */
    manifest: iManifest;
    /** Property Formats are a set of rules applied to a content type's property that dictate how it should behave, validate, and be presented to editors. While a Property Data Type defines what kind of data is stored (e.g., a string, a number, a date), the Property Format defines how that data is handled in the system. */
    propertyformats: iPropertyFormats;
    /** Property Groups are organizational containers used to categorize properties within the editing interface. To a content editor, property groups appear as tabs in the edit view. */
    propertygroups: iPropertyGroups;
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

    // Convenience: wire up logging from the cmssdk call. This is fire-and-forget
    // because cmssdk is synchronous; for guaranteed capture of the very first
    // request, call `await configureLogging(...)` yourself before cmssdk().
    // `debug: true` is shorthand for mirroring logs to the console.
    if (options?.logging || options?.debug) {
        configureLogging(options.logging ?? { console: true }).catch((err) =>
            console.error("cmssdk: failed to configure logging", err)
        )
    }



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

