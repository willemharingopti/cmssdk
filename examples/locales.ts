import { cmssdk } from "../src/sdk.ts"

if (import.meta.main) {
   const client = cmssdk({logging: {level: "debug", console: true}})
   
   await client.locales().post({
      displayName: "no-BK",
      key: "no-BK",
      routeSegment: "no-BK"
   })

   const locs = await client.locales().list()
   const no = locs.items?.find(loc => loc.key === "no-BK")
   if (no) await client.locales({key: no.key}).delete()
}

