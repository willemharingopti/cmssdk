import { cmssdk } from "../sdk.ts"
import * as assert from "node:assert";


Deno.test("applications", async (test) => {
    const client = cmssdk()
    if (client === undefined) assert.fail("unable to create cmssdk client")
    await test.step("list", async () => {
        const list = await client.applications().list()
        assert.ok(list, "no list returned from applications")
    })
    await test.step("get", async () => {
        
    })
})

