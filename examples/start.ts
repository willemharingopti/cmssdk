import { defaultConsoleFormatter } from "@logtape/logtape"
import { cmssdk } from "../src/sdk.ts"

const client = cmssdk() //cmssdk({logging: {level: "info", console: true}})

   


const list = await client.applications({key: "astro"}).get()
console.log(list)