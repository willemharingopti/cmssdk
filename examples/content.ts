import * as dotenv from "dotenv"

interface iToken {
  token_type: "Bearer",
  access_token: string
  expires_in: number
}

type ParamList = Record<string, string | number>[]

const buildParamString = (paramsArray: ParamList): string => {
    const queryParams = new URLSearchParams()
    paramsArray.forEach(obj => {
        // Extract the key and value from each object
        Object.entries(obj).forEach(([key, value]) => {
            queryParams.append(key, value as string);
        });
    });
    return "?" + queryParams.toString()
}

dotenv.config({quiet: true})

const auth = async (base_url: string, client_id: string, client_secret: string): Promise<iToken | undefined> => {
    const response = await fetch(`${base_url}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: client_id,
            client_secret: client_secret,
         }),
    })
    if (response.ok) {
        const result = await response.json()
        return result as iToken
    }
    return undefined
}

// deno-lint-ignore no-explicit-any
const api = async (base_url: string, method: string, token: iToken, path: string, params?: ParamList, body?: any): Promise<any> => {
    const queryparams = (params) ? buildParamString(params) : ""
    
    try {
        const response = await fetch(`${base_url}/v1/${path}${queryparams}`, {
            method: method,
            headers: {
                "Accept": "application/json",
                "Authorization": `${token.token_type} ${token.access_token}`
            },
            body: JSON.stringify(body)
        })
        if (response.ok) {
            const result = await response.json()
            return result as iToken
        }
        console.log(await response.text(), response.statusText)
        
    }
    catch (_error) {
        console.log(_error)
    }
    return undefined
}


const token = await auth(process.env.OPTIMIZELY_CMS_BASE_URL!, process.env.OPTIMIZELY_CMS_CLIENT_ID!, process.env.OPTIMIZELY_CMS_CLIENT_SECRET!)

const response = await api(process.env.OPTIMIZELY_CMS_BASE_URL!, "GET", token!,  "content/versions", [{"pageIndex": 0}, {"pageSize": 100}] )
console.log(response)
console.log(response.items.length)