# OpenAPI TypedSDK Skill

This skill defines a pattern for implementing type-safe OpenAPI APIs using the TypedSDK pattern demonstrated in `cmssdk/applications.ts`.

## Pattern Overview

The pattern provides **overloaded function signatures** that create intuitive APIs matching REST semantics:
- **Collection-level**: `resource()` returns list/create methods
- **Item-level**: `resource(key)` returns get/delete/patch methods

### Resource factories (required)

Every resource module **must** be a factory named `createResource(client: TypedSdkClient)` that
closes over a single injected `client` and returns the overloaded `resource` function. Resources
**never** call `typedsdk()` themselves — they only use the injected `client`.

This is what lets `cmssdk(options)` build one client (with a cached OAuth token) and share it across
all resources, and lets multiple SDK instances use different credentials independently. Calling
`typedsdk()` inside a resource would create a fresh client per call, re-authenticating on every
request and breaking per-instance credentials.

```typescript
import type { TypedSdkClient } from "./openapi/typedsdk.ts"

// Public API type (required) — see "Explicit return types" below.
export interface ResourceApi {
  (): { /* collection methods */ }
  (key: ResourceKeyParam): { /* item methods */ }
}

export function createResource(client: TypedSdkClient): ResourceApi {
  function resource(): { /* collection overload */ }
  function resource(key: ResourceKeyParam): { /* item overload */ }
  function resource(key?: ResourceKeyParam) {
    // ...implementation, using `client` (never typedsdk())
  }
  return resource
}
```

### Explicit return types (required for JSR)

This package publishes to JSR, which forbids ["slow types"](https://jsr.io/docs/about-slow-types):
**every exported function in the public API must declare an explicit return type.** A resource
factory whose return type is inferred will fail `deno publish` with
`error[missing-explicit-return-type]`.

So each resource **must** export an `XApi` interface with the overloaded call signatures and use it
as the factory's return type (`export function createResource(client): ResourceApi`). The inner
overloaded `resource` function provides the implementation; `return resource` is assignable to
`ResourceApi` because their signatures match. Run `deno publish --dry-run --allow-dirty` to verify.

## Core Pattern

### 1. Type Extraction from OpenAPI

Extract types from your OpenAPI schema paths:

```typescript
import type { TypedSdkClient } from "./openapi/typedsdk.ts"
import type { paths } from "./openapi/paths.ts"
import { handleerror } from "./utils.ts"

// List/Get responses
type ListResponse = paths["/resource"]["get"]["responses"][200]["content"]["application/json"]
type GetResponse = paths["/resource/{key}"]["get"]["responses"][200]["content"]["application/json"]

// Request/Response pairs
type CreateRequest = paths["/resource"]["post"]["requestBody"]["content"]["application/json"]
type CreateResponse = paths["/resource"]["post"]["responses"][201]["content"]["application/json"]

type PatchRequest = paths["/resource/{key}"]["patch"]["requestBody"]["content"]["application/merge-patch+json"]
type PatchResponse = paths["/resource/{key}"]["patch"]["responses"][200]["content"]["application/json"]

type DeleteResponse = paths["/resource/{key}"]["delete"]["responses"][200]["content"]["application/json"]
```

### 2. Parameter Types

Define parameter types for keys and query filtering:

```typescript
export type ResourceKeyParam = { key: string }
export type ResourceQueryParam = { pageIndex?: number; pageSize?: number; filter?: string }
```

### 3. Enhanced Request Types

Enhance raw request types with developer-friendly alternatives (optional):

```typescript
// Allow flexible input while mapping to strict API format
type RawResourceCreate = paths["/resource"]["post"]["requestBody"]["content"]["application/json"]

type ResourceCreateRequest = Omit<RawResourceCreate, "type"> & {
  /**
   * Supported types. Use one of: 'type1' | 'type2'
   */
  type?: string | string[] | RawResourceCreate["type"]
}
```

### 4. Overloaded Function Signatures with JSDoc

Define two overloads with JSDoc documentation extracted from OpenAPI. The overloads are
**nested inside the `createResource(client)` factory** (not exported individually):

```typescript
export function createResource(client: TypedSdkClient) {
// Collection-level operations
function resource(): {
  /**
   * Retrieves a paginated list of resources.
   * 
   * @param query - Optional query parameters for filtering and pagination
   * @param query.pageIndex - Zero-based page index (default: 0)
   * @param query.pageSize - Number of results per page (default: 20)
   * @param query.filter - Optional filter expression
   * @returns Promise resolving to paginated resource list
   * @throws Error if the request fails
   * 
   * @example
   * const resources = await resource().get()
   * const page2 = await resource().get({ pageIndex: 1, pageSize: 50 })
   */
  list: (query?: ResourceQueryParam) => Promise<ListResponse>
  
  /**
   * Creates a new resource.
   * 
   * @param body - Resource data to create
   * @param body.name - Resource name (required)
   * @param body.type - Resource type: 'type1' | 'type2' (required)
   * @param body.description - Optional resource description
   * @returns Promise resolving to the created resource with assigned key
   * @throws Error if validation fails or request cannot be completed
   * 
   * @example
   * const newResource = await resource().post({
   *   name: "My Resource",
   *   type: "type1",
   *   description: "A test resource"
   * })
   */
  post: (body: ResourceCreateRequest) => Promise<CreateResponse>
}

// Item-level operations
function resource(key: ResourceKeyParam): {
  /**
   * Retrieves a specific resource by key.
   * 
   * @returns Promise resolving to the resource data
   * @throws Error if the resource is not found (404) or request fails
   * 
   * @example
   * const resource = await resource({ key: "abc-123" }).get()
   */
  get: () => Promise<GetResponse>
  
  /**
   * Partially updates a resource using JSON Merge Patch.
   * 
   * Only provided fields are updated; omitted fields are unchanged.
   * 
   * @param body - Fields to update (all fields optional)
   * @param body.name - Updated resource name
   * @param body.type - Updated resource type
   * @param body.description - Updated resource description
   * @returns Promise resolving to the updated resource
   * @throws Error if the resource is not found (404) or validation fails
   * 
   * @example
   * const updated = await resource({ key: "abc-123" }).patch({
   *   name: "Updated Name"
   * })
   */
  patch: (body: PatchRequest) => Promise<PatchResponse>
  
  /**
   * Deletes a resource.
   * 
   * This operation cannot be undone.
   * 
   * @returns Promise resolving to deletion confirmation or void
   * @throws Error if the resource is not found (404) or deletion fails
   * 
   * @example
   * await resource({ key: "abc-123" }).delete()
   */
  delete: () => Promise<DeleteResponse | void>
}

// Implementation with optional parameter
function resource(key?: ResourceKeyParam) {
  // ... implementation
}

  return resource
}
```

### 5. Implementation Structure

Implement each HTTP method as an inner function, using the injected `client` (never `typedsdk()`).
The whole thing lives inside the `createResource(client)` factory, which returns `resource`:

```typescript
export function createResource(client: TypedSdkClient) {
  function resource(key?: ResourceKeyParam) {
    const listResources = async (query?: ResourceQueryParam): Promise<ListResponse> => {
      const res = await client.GET("/resource", { params: { query } })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as ListResponse
    }

    const getResource = async (keyParam: ResourceKeyParam): Promise<GetResponse> => {
      const res = await client.GET(`/resource/{key}`, { params: { path: keyParam } })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as GetResponse
    }

    const createResource = async (body: ResourceCreateRequest): Promise<CreateResponse> => {
      const res = await client.POST("/resource", { body: body as unknown as RawResourceCreate })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as CreateResponse
    }

    const patchResource = async (keyParam: ResourceKeyParam, body: PatchRequest): Promise<PatchResponse> => {
      const res = await client.PATCH(`/resource/{key}`, { params: { path: keyParam }, body })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as PatchResponse
    }

    const deleteResource = async (keyParam: ResourceKeyParam): Promise<DeleteResponse | void> => {
      const res = await client.DELETE(`/resource/{key}`, { params: { path: keyParam } })
      const errorMessage = handleerror(res)
      if (errorMessage) throw new Error(errorMessage)
      return res.data as DeleteResponse | void
    }

    // Return appropriate interface based on whether key was provided
    if (key) {
      return {
        get: async () => await getResource(key),
        patch: async (body: PatchRequest) => await patchResource(key, body),
        delete: async () => await deleteResource(key),
      }
    }

    return {
      list: async (query?: ResourceQueryParam) => await listResources(query),
      post: async (body: ResourceCreateRequest) => await createResource(body),
    }
  }

  return resource
}
```

### 6. Register the resource in the SDK entry point

Wire the factory into `cmssdk()` so it receives the shared client. `cmssdk(options)` builds a single
client via `typedsdk(options)` and binds every resource to it:

```typescript
// sdk.ts
import { createResource } from "./resource.ts"
import { typedsdk, type iOptions } from "./openapi/typedsdk.ts"

export interface CmsSdkInstance {
  resource: ReturnType<typeof createResource>
  // ...other resources
}

export const cmssdk = (options?: iOptions): CmsSdkInstance => {
  const client = typedsdk(options)
  return {
    resource: createResource(client),
    // ...other resources, all sharing the same client
  }
}
```

## Usage Examples

### List resources
```typescript
const list = await resource().list()
const filtered = await resource().get({ pageSize: 10, filter: "active" })
```

### Get single resource
```typescript
const item = await resource({ key: "123" }).get()
```

### Create resource
```typescript
const created = await resource().post({ name: "My Resource", type: "type1" })
```

### Update resource
```typescript
const updated = await resource({ key: "123" }).patch({ name: "Updated Name" })
```

### Delete resource
```typescript
await resource({ key: "123" }).delete()
```

## Key Benefits

1. **Type Safety**: Full end-to-end typing from OpenAPI schema
2. **Ergonomic API**: Overloads match REST semantics
3. **Error Handling**: Centralized error handling via `handleerror()`
4. **Flexibility**: Support for enhanced request types (enums, unions, etc.)
5. **Consistency**: Reusable pattern across multiple resources
6. **Self-Documenting**: JSDoc extracted from OpenAPI schema enables IDE autocomplete

## Extracting JSDoc from OpenAPI

### Operation-level documentation

From OpenAPI `paths["/resource"]["get"]`:
- Use `description` field for method summary
- Use `summary` field as brief title if present
- Include error codes from `responses` in `@throws`

```yaml
# OpenAPI
get:
  summary: "Retrieves a paginated list of resources"
  description: "Fetches all resources with optional filtering and pagination. Results are sorted by creation date."
  parameters:
    - name: pageIndex
      description: "Zero-based page index"
    - name: pageSize
      description: "Number of results per page"
  responses:
    200:
      description: "Successful response"
    400:
      description: "Invalid query parameters"
    401:
      description: "Unauthorized"
    500:
      description: "Server error"
```

Maps to:
```typescript
/**
 * Retrieves a paginated list of resources.
 * 
 * Fetches all resources with optional filtering and pagination. Results are sorted by creation date.
 * 
 * @param query - Query parameters
 * @param query.pageIndex - Zero-based page index
 * @param query.pageSize - Number of results per page
 * @returns Promise resolving to paginated resource list
 * @throws Error on 400 (Invalid query), 401 (Unauthorized), 500 (Server error), or other failures
 */
get: (query?: ResourceQueryParam) => Promise<ListResponse>
```

### Request body documentation

From OpenAPI `paths["/resource"]["post"].requestBody.content["application/json"].schema`:

```yaml
# OpenAPI
post:
  requestBody:
    required: true
    content:
      application/json:
        schema:
          type: object
          required: [name, type]
          properties:
            name:
              type: string
              description: "Human-readable resource name"
            type:
              type: string
              enum: ["type1", "type2"]
              description: "Resource type classification"
            description:
              type: string
              description: "Optional detailed description"
```

Maps to:
```typescript
/**
 * Creates a new resource.
 * 
 * @param body - Resource data to create
 * @param body.name - Human-readable resource name (required)
 * @param body.type - Resource type: 'type1' | 'type2' (required)
 * @param body.description - Optional detailed description
 * @returns Promise resolving to the created resource with assigned ID
 */
post: (body: ResourceCreateRequest) => Promise<CreateResponse>
```

### HTTP method semantics in JSDoc

| Method | JSDoc Pattern |
|--------|---------------|
| GET    | "Retrieves" or "Fetches" - describe data returned |
| POST   | "Creates" - describe entity being created |
| PATCH  | "Partially updates" or "Modifies" - describe fields updated |
| DELETE | "Deletes" or "Removes" - emphasize irreversibility |

### Parameter documentation

Include in `@param`:
- Parameter name and type
- Description from OpenAPI
- Default values
- Constraints/enums
- Whether required (use OpenAPI `required` array)

```typescript
/**
 * @param query.pageSize - Number of results per page (default: 20, max: 100)
 * @param query.filter - Optional filter expression using simple query syntax
 */
```

## Key Benefits

1. **Type Safety**: Full end-to-end typing from OpenAPI schema
2. **Ergonomic API**: Overloads match REST semantics
3. **Error Handling**: Centralized error handling via `handleerror()`
4. **Flexibility**: Support for enhanced request types (enums, unions, etc.)
5. **Consistency**: Reusable pattern across multiple resources
6. **Self-Documenting**: JSDoc extracted from OpenAPI enables IDE autocomplete

## Implementation Checklist

- [ ] Generate or have OpenAPI `paths.ts` type definitions
- [ ] Import `TypedSdkClient` (type) and `handleerror` utility — **do not** import `typedsdk` into a resource
- [ ] Extract response/request types from schema paths
- [ ] Define parameter types (key, query filters)
- [ ] Export a `ResourceApi` interface with the overloaded call signatures (the public API type)
- [ ] Wrap everything in a `createResource(client: TypedSdkClient): ResourceApi` factory (explicit return type — required for JSR)
- [ ] Create function overloads (nested inside the factory)
- [ ] Implement inner functions for each HTTP method, using the injected `client` (never `typedsdk()`)
- [ ] Add conditional return based on `key` parameter
- [ ] `return resource` from the factory
- [ ] Register the resource in `cmssdk()` (sdk.ts) so it receives the shared client
- [ ] Export types for public API surface
- [ ] Verify with `deno publish --dry-run --allow-dirty` (no slow-type errors)
