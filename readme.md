# cmssdk

**cmssdk is an sdkwrapper arround the [Optimizely Content Management System (CMS) (SaaS) REST API](https://docs.developers.optimizely.com/content-management-system/v1.0.0-CMS-SaaS/reference/introduction-to-the-cms-content-api). This sdk is designed to create a fully typed sdk, so that working with entiries in Optimizely CMS becomes really easy and fully typed.**

## installing

**deno**


```bash
deno add jsr:@willemharingopti/cmssdk
```

**node**
```bash
npx jsr add @willemharingopti/cmssdk
```


## Usage

Create an .env file in the root of you project, containing the following fields:

```bash
OPTIMIZELY_CMS_CLIENT_ID=YOUR_CLIENT_ID
OPTIMIZELY_CMS_CLIENT_SECRET=YOUR_CLIENT_SECRET
OPTIMIZELY_CMS_BASE_URL=https://api.cms.optimizely.com
```

Create a typescript file, import the sdk and start using it

```typescript
import { cmssdk } from "@willemharingopti/cmssdk"

const client = cmssdk()
   
console.log(await client.applications().list())  // list all applications

console.log(await client.applications().list({pageSize: 2})) // list the first 2 appliciations

const myapp = await client.applications({key: "clean"}).get() // get the application with the key: clean
console.log(myapp)
console.log(await client.content({key: keyFromEntryPoint(myapp.entryPoint)}).items()) // list all the items under the entrypoint

```

## Available resources

All resources are accessed from the `cmssdk()` client and share a single authenticated client:

- `applications`
- `blueprints`
- `contenttypes`
- `content`
- `sources` (content sources)
- `bindings` (content type bindings)
- `displaytemplates`
- `locales`
- `manifest` — `export()` / `import()`
- `propertyformats` — read-only (`list()` / `get()`)
- `propertygroups`

```typescript
const client = cmssdk()

await client.locales().list()
await client.propertygroups({ key: "settings" }).get()
await client.manifest().export({ sections: ["contentTypes", "locales"] })
```

Credentials can be passed through the constructor (otherwise read from `OPTIMIZELY_CMS_*` env vars):

```typescript
const client = cmssdk({ client_id: "...", client_secret: "...", base_url: "https://api.cms.optimizely.com" })
```

## Logging

The SDK logs through [LogTape](https://logtape.org) but stays silent until you wire up a sink with `configureLogging`. Logs are split into two categories under the `cmssdk` root: `["cmssdk", "api"]` for raw HTTP request/response traffic and `["cmssdk", "entity"]` for high-level resource operations.

Because LogTape's configuration is process-global, call `configureLogging` once at application startup — before creating the client — so the very first requests are captured:

```typescript
import { cmssdk, configureLogging } from "@willemharingopti/cmssdk"

await configureLogging({ file: "cms.log", console: true })

const client = cmssdk()
```

`configureLogging` accepts a `LoggingOptions` object:

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `file` | `string` | — | Write logs to this file path. Omit to skip the file sink. |
| `console` | `boolean` | `false` | Mirror logs to the console as well. |
| `level` | `LogLevel` | `"debug"` | Lowest level recorded (see below). |
| `reset` | `boolean` | `true` | Reset any previous LogTape configuration first. |

The `level` controls verbosity across both categories with a single threshold:

- `"trace"` — full Request/Response objects (headers, body, the lot) + URL lines + entity ops
- `"debug"` — HTTP method/URL lines + entity ops
- `"info"` — entity-level operations only
- `"warning"` (or higher) — warnings/errors only

For full control you can also wire the exported `apiLogger` and `entityLogger` into LogTape's own `configure` directly.

## Roadmap
- Everything in the public CMS API surface is now wrapped. Future work: richer enhanced
  request types (string-reference hints) for the newly added resources.