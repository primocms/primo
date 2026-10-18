import {test} from 'node:test'
import {chromium,firefox,webkit} from '@playwright/test'
import {fixture,assert,fs} from './fixture.mjs'
const engine=process.env.PRIMO_BROWSER||'chromium'
test(engine+' fresh production sign-in renders and opens only the assigned site',{timeout:120000},async t=>{
 const c=await fixture(t),browser=await {chromium,firefox,webkit}[engine].launch({headless:true});t.after(()=>browser.close())
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(c.redact(error.message)))
 let canceledRefresh=0,recoveredRefresh=0
 const report={...c.provenance,status:'FAIL',browser:engine,browserVersion:browser.version(),pageErrors:errors}
 t.after(()=>{Object.assign(report,{canceledAuthRefresh:canceledRefresh,recoveredAuthRefresh:recoveredRefresh});return fs.writeFile('auth-'+engine+'.json',JSON.stringify(report,null,2)+'\n')})
 await page.goto(c.origin+'/admin/auth')
 await page.locator('input[type=email]').fill(c.actors.editor.email)
 await page.locator('input[type=password]').fill(c.actors.editor.password)
 await page.route('**/api/collections/users/auth-refresh',async route=>{if(!canceledRefresh){canceledRefresh++;await route.abort('failed')}else await route.continue()})
 page.on('response',response=>{if(response.url().includes('/users/auth-refresh')&&response.ok())recoveredRefresh++})
 // Observe only whether a credential was cleared, never its secret value.
 await page.evaluate(()=>{
  const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem
  Storage.prototype.setItem=function(key,value){if(this===localStorage&&key==='pocketbase_auth'&&!JSON.parse(value||'{}').token)sessionStorage.setItem('qa-session-cleared','true');return set.call(this,key,value)}
  Storage.prototype.removeItem=function(key){if(this===localStorage&&key==='pocketbase_auth')sessionStorage.setItem('qa-session-cleared','true');return remove.call(this,key)}
 })
 await page.locator('button[type=submit]').click()
 await page.waitForURL('**/admin/dashboard/sites');await page.locator('.site-card-footer a').waitFor()
 assert.equal(await page.locator('.site-card').count(),1)
 assert.equal(canceledRefresh,1);assert.ok(recoveredRefresh>0,'A canceled refresh must recover using the valid stored session')
 assert.equal(await page.evaluate(()=>sessionStorage.getItem('qa-session-cleared')),null,'Transport failures must not discard a valid session')
 assert.deepEqual(errors,[]);await c.verifyContent()
 Object.assign(report,{status:'PASS_FRESH_SCOPED_SIGN_IN',freshPasswordSignIn:true,assignedSites:1,contentAndAllIdsRetained:true,canceledAuthRefresh:canceledRefresh,recoveredAuthRefresh:recoveredRefresh,validSessionPreserved:true})
 console.log(report)
})
