import { cmssdk } from "./src/sdk.ts"
import { keyFromEntryPoint } from "./src/utils.ts"



if (import.meta.main) {
   const client = cmssdk()
   
   //console.log(await client.applications().list())  // list all applications

   //console.log(await client.applications().list({pageSize: 2})) // list the first 2 appliciations
   
   const myapp = await client.applications({key: "clean"}).get() // get the application with the key: clean
   //console.log(myapp)
   console.log(await client.content({key: keyFromEntryPoint(myapp.entryPoint)}).items())
/*
   const homepage = await client.content().post({
      contentType: "BlankExperience",
      initialVersion: {
         displayName: "home",
      }

   })
   await client.applications().post({
      displayName: "from api",
      entryPoint: homepage.key!
   })
*/ 
}














































//const list = await sdk().applications().get({pageSize: 10})
   //list.items?.map(item => console.log(item.entryPoint, item.displayName))
   
   //console.log(await sdk().applications({key: "astro"}).get())
   
   //const bplist = await sdk().contenttypes().get()
   //bplist.items?.map(item => console.log(item.key, item.displayName))

   //console.log(await sdk().contenttypes({key: "Carousel"}).get())

   //const clist = await client.content().list({statuses: ["published", "inReview"], locales: ["en"]})
   //clist.items?.map(item => console.log(item))

   //console.log(await client.content({key: "edbb3527f7fb422fb3ae372d296a0a5a"}).get())

   //console.log(await client.content({key: "edbb3527f7fb422fb3ae372d296a0a5a"}).copy())
   //console.log(await client.content({key: "edbb3527f7fb422fb3ae372d296a0a5a"}).items())

   /*
   const newx = await client.content().post({
      contentType: "LandingPage",
      initialVersion: {
         displayName: "Newly created landingpage",
         locale: "en"
      },
      container: "edbb3527f7fb422fb3ae372d296a0a5a"
   })
   console.log(newx)
   */
   //console.log(await client.applications({key: "ttt"}).delete())
   //console.log(await client.applications({key: "somethings"}).get())

   
   //console.log(await client.contenttypes("PageSeoSettings").get())
/*
   const app = await client.applications().post({
      displayName: "sdk test",
      type: "website",
      entryPoint: "cms://content/4f13a78669a54e119ec1a31eeb41e6e5",
      
   })
   console.log(app)
   */