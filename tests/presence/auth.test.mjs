import {test} from 'node:test'
import {chromium,firefox,webkit} from '@playwright/test'
import {fixture,assert,fs} from './fixture.mjs'
const engine=process.env.PRIMO_BROWSER||'chromium'
test(engine+' fresh production sign-in renders and opens only the assigned site',{timeout:120000},async t=>{
 const c=await fixture(t),browser=await {chromium,firefox,webkit}[engine].launch({headless:true});t.after(()=>browser.close())
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(c.redact(error.message)))
 const report={...c.provenance,status:'FAIL',browser:engine,browserVersion:browser.version(),pageErrors:errors}
 t.after(()=>fs.writeFile('auth-'+engine+'.json',JSON.stringify(report,null,2)+'\n'))
 await page.goto(c.origin+'/admin/auth')
 await page.locator('input[type=email]').fill(c.actors.editor.email)
 await page.locator('input[type=password]').fill(c.actors.editor.password)
 await page.locator('button[type=submit]').click()
 await page.waitForURL('**/admin/dashboard/sites');await page.locator('.site-card-footer a').waitFor()
 assert.equal(await page.locator('.site-card').count(),1)
 assert.deepEqual(errors,[]);await c.verifyContent()
 Object.assign(report,{status:'PASS_FRESH_SCOPED_SIGN_IN',freshPasswordSignIn:true,assignedSites:1,contentAndAllIdsRetained:true})
 console.log(report)
})
