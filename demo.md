# sharpening stone demo

1. opening

2. My background and life at commercetools. Emea role, mostly in the benelux. Have been really successfull (2 x presidents club), but also time for a change

3. About me

4. commercetools 
    - The good:
        - it has no opinion, you can shape it and use it however you want
        - No version, so no breaking changes (it actually slows things down aswell, from a companies perspective)
        - Extremely high uptime, have not seen real downtime in my 4,5 years with the company.
        - Since everything starts at the API level, everything is really wel thought thru. All documentation is actually generated from the API specs, so very little challenges there.
        - It is very predictable. Allways works. When you need a new instance you spin one up in 5 seconds
        - You can use external tools like terraform for configuration management, to allways have a defined and configured starting point
    - The bad
    - The ugly
        - commerce only
        - weak ai strategy, LOTS of dependencies on the big tech vendors

5. storytelling:
    - doing a demo of an api is really boring, so i changed that. While my peers in emea where still doing demo's with graphql and postman, i build very small demo's using all sorts of tooling
    - to show that api's are not scary
    - tell the story what the benefits are
    - and ask for 3 usecases to show, and in that way avoid lengthy proof of concepts
    - and i talked more with my AE's then with my wife to be honoust

6. My impressions of optimizely

7. Explain that a lot of information is coming to me, new brand, new messaging, old things and new things, quite hard to determine what is important and what not. Since my background with Sitecore i thought that cms might be a good starting point

8. I need to get used to the fact that there is information that is not relevant for me.
    - i have no interest in CMS 11, CMS 12
    - search and navigation seems to be something from the past aswell
    - form, from my first impression seems to be handled in a different way now
    - I have not seen a reason to look at the community API
    - Content delivery api seems to be superseeded by Graph
    - Content definitions seems to be included in the Content Management API's

Don't get me wrong, i intentionally state it like this. This is just my way of looking at things. Remember i also wired my opal to the generic CMP demo....

9.  then i started testing. I played arround with the UI, CMS seems pretty straigt forward. Was confused a bit with the statement "presentation is separated from content" when i played arround with visual editor, that explicitly includes presentation elements. but that is not bad. I wanted to better understand the inner workings a bit more, so started to play arround with the content management API. My first test with the REST client in vscode:

Demo: content.http
    Show auth
    Show the content call
    Show the content type call 

10. But if you wan to do a bit more with api's, you need to stich a couple of calls together. What i really enjoy using is Deno. An alternative runtime to nodejs, that has everything in there. As standard library, runs typescript out of the box, has linting, formatting, testing etc build in and is compatible with node.

Ideal for experimentation. So i installed that

11. Did my first API calls with deno, works fine, bit is far from intuetive.

Demp: deno -A content.ts

12. So where are we, i did rest client to the cms, i did deno to the cms, then i saw that the documentation page also contains an openapi spec. looked at that and started playing with it on my way back home on the train. Maybe i could use that specification to create a very intuetive sdk 

show the openapispec 

13. So i stared building an sdk that used the open api spec...

14. That resulted really quickly in an sdk for the cms, that is very easy to use. I published it on jsr, a deno way of doing npm. But let me show you what i mean with simple to use:

deno -A example.ts
deno -A applications.ts
deno -A locale.ts

15. so that gives me a very usefull and powerfull sdk, that initializes the access to optimizely thru the .env file with the oAuth id and secret. And it is fully typed, so very easy to use

16. The kunal asked me if i could do a CLI as well. That said, claude could do a cli. and quickly. Based on the sdk, i had a cli working in no time. Also published on jsr amd for you to use!

cms

17. Then i thought, what ben showed last week, where opal populated a cms and cmp using a workflow, i can do that from a set of skills in claude aswell.

18. so now i can create a site in cms, using a set of skills in claude. this uses my cli, based on the sdk to scrape and create!

Show the results
