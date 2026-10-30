import {test} from 'node:test'
import {chromium,firefox,webkit} from '@playwright/test'
import {fixture,assert,fs} from './fixture.mjs'
const engine=process.env.PRIMO_BROWSER||'chromium'
test(engine+' scoped dashboard recovers canceled user and site-list loads without a reload',{timeout:120000},async t=>{
 const c=await fixture(t),browser=await {chromium,firefox,webkit}[engine].launch({headless:true});t.after(()=>browser.close())
 const context=await browser.newContext();await context.addInitScript(auth=>localStorage.setItem('pocketbase_auth',JSON.stringify(auth)),c.actors.editor.auth)
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(c.redact(error.message)))
 let canceledUser=0,canceledList=0,recoveredUser=0,recoveredList=0
 const user='/api/collections/users/records/'+c.actors.editor.auth.record.id,sites='/api/collections/sites/records'
 const report={...c.provenance,status:'FAIL',browser:engine,browserVersion:browser.version(),pageErrors:errors}
 t.after(async()=>{Object.assign(report,{canceledUser,canceledList,recoveredUser,recoveredList});await fs.writeFile('cache-'+engine+'.json',JSON.stringify(report,null,2)+'\n')})
 await page.route('**'+user,async route=>{if(canceledUser<2){canceledUser++;await route.abort('failed')}else await route.continue()})
 await page.route('**'+sites+'?**',async route=>{if(!canceledList){canceledList++;await route.abort('failed')}else await route.continue()})
 page.on('response',response=>{if(!response.ok())return;if(response.url().includes(user))recoveredUser++;if(response.url().includes(sites+'?'))recoveredList++})
 await page.goto(c.origin+'/admin/dashboard/sites')
 await page.locator('.site-card-footer a').waitFor({timeout:15000})
 assert.equal(await page.locator('.site-card').count(),1,'Only the assigned site may be visible')
 assert.ok(canceledUser===2&&canceledList===1&&recoveredUser>0&&recoveredList>0,'Both canceled caches must recover')
 assert.deepEqual(errors,[]);await c.verifyContent()
 Object.assign(report,{status:'PASS_CANCELED_CACHE_LOADS',assignedSites:1,contentAndAllIdsRetained:true})
 console.log(report)
})
