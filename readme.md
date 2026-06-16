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

## Roadmap
- Everything in the public CMS API surface is now wrapped. Future work: richer enhanced
  request types (string-reference hints) for the newly added resources.