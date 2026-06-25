import { cmssdk } from "./src/sdk.ts"


if (import.meta.main) {

   const client = cmssdk({logging: {level: "info", console: true}})


   const list = await client.content().list()
   //console.log(list)
}
