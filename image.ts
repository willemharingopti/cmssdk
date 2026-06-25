import { cmssdk } from "./src/sdk.ts"
import { keyFromEntryPoint } from "./src/utils.ts"

// CMS content type for the media node. Must exist on your instance. "GenericMedia"
// accepts any file; use "ImageMedia" if your instance has it for images.
const MEDIA_CONTENT_TYPE = "ImageMedia"

if (import.meta.main) {
   const client = cmssdk()
   if (client === undefined) throw new Error("unable to create cmssdk client")

   // Uploads need a container (the API requires 'container' or 'owner'). Fall back to
   // the first application's entry point, same as the integration test.
   const apps = await client.applications().list()
   const entryPoint = apps.items?.[0]?.entryPoint
   const container = entryPoint ? keyFromEntryPoint(entryPoint) : undefined
   if (!container) throw new Error("could not resolve a container (no applications on the instance)")

   // Read the real image bytes from the project root. The file part needs a filename
   // WITH an extension, so wrap the bytes in a File (a bare Blob has no name and the
   // API rejects it: "File name is missing an extension").
   const bytes = await Deno.readFile(new URL("./butterfly-png.png", import.meta.url))
   const file = new File([bytes], "butterfly-svg.png", { type: "image/png" })

   const key = crypto.randomUUID().replaceAll("-", "")
   const result = await client.content().upload({
      content: {
         key,
         contentType: MEDIA_CONTENT_TYPE,
         container,
         initialVersion: { displayName: "butterfly", locale: "en" },
      },
      file,
   })

   console.log(`uploaded media key: ${key}`)
   console.log(result)
}
