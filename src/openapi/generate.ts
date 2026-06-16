import openapiTS, { astToString } from "openapi-typescript"
import { parseArgs } from "@std/cli"

const fetchOpenAPI = async (targetpath: string) => {
   const ast = await openapiTS(
      new URL("https://docs.developers.optimizely.com/content-management-system/v1.0.0-CMS-SaaS/openapi/Optimizely.Cms.Service.V1.Content.OpenApiGeneration.json", import.meta.url),
   )
   const paths = astToString(ast)
   Deno.writeTextFileSync(targetpath, paths)
   console.log(`Written openapi specifications to: ${targetpath}`)
}

export const loadSpec = async (targetpath?: string): Promise<boolean> => {
   if (targetpath === undefined) console.log(`Specift a path where to save the openapi specification`)
   console.log(`loading api spec and storing it at: ${targetpath}`)
   await fetchOpenAPI(targetpath!)
   return true
}

if (import.meta.main) {
   const args = parseArgs(Deno.args, {
      string: ["path"]
   })
   
   await loadSpec(args.path)
}
