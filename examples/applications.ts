import { cmssdk } from "../src/sdk.ts"
import { keyFromEntryPoint } from "../src/utils.ts"

if (import.meta.main) {
   const client = cmssdk({logging: {level: "info", console: true}})
   
   const list = await client.applications({key: "astro"}).get()
   console.log(list)
   //const content = await client.content({key: keyFromEntryPoint(list.entryPoint)}).get()
   //console.log(content)
}

