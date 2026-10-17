import {test} from 'node:test'
import {chromium,firefox,webkit} from '@playwright/test'
import {fixture,assert,fs,delay} from './fixture.mjs'
const engine=process.env.PRIMO_BROWSER||'firefox'
test(engine+' production presence survives canceled requests, inline save, nested reorder and abrupt reload', {timeout:240000},async t=>{
 const c=await fixture(t),browser=await {chromium,firefox,webkit}[engine].launch({headless:true});t.after(()=>browser.close())
 const context=await browser.newContext();await context.addInitScript(auth=>localStorage.setItem('pocketbase_auth',JSON.stringify(auth)),c.actors.editor.auth)
 const page=await context.newPage(),errors=[],errorStacks=[];page.on('pageerror',error=>{errors.push(error.message);errorStacks.push(error.stack)})
 let aborted=0,recovered=0
 const report={...c.provenance,status:'FAIL',browser:engine,browserVersion:browser.version(),pageErrors:errors,errorStacks}
 t.after(async()=>{Object.assign(report,{canceledPresenceUpdate:aborted,subsequentSuccessfulPresenceUpdates:recovered});await fs.writeFile('presence-'+engine+'.json',JSON.stringify(report,null,2)+'\n')})
 await page.route('**/api/collections/user_activities/records/**',async route=>{if(route.request().method()==='PATCH'&&!aborted){aborted++;await route.abort('failed')}else await route.continue()})
 page.on('response',response=>{if(response.url().includes('/user_activities/records/')&&response.request().method()==='PATCH'&&response.ok())recovered++})
 const ready=()=>page.waitForFunction(()=>{const frames=[...document.querySelectorAll('main iframe[title=block]')];return frames.length===5&&frames.every(f=>f.contentDocument?.querySelector('h1[contenteditable=true]'))},null,{timeout:90000})
 await page.goto(c.origin+'/admin/sites/'+c.site.id);await ready()
 for(let n=0;n<180&&(!aborted||!recovered);n++)await delay(100)
 assert.equal(aborted,1,'An actual presence update must have been canceled');assert.ok(recovered>0,'Heartbeat must resume after the canceled request')
 const title=page.locator('main iframe[title=block]').first().contentFrame().locator('h1[data-key=heading]'),tag='Saved while presence recovers'
 const save=page.waitForResponse(r=>r.url().includes('/page_section_entries/records/'+c.heading.id)&&r.request().method()==='PATCH')
 await title.fill(tag);await title.blur();assert.ok((await save).ok());await page.reload();await ready();await c.verifyContent(tag)
 const own=c.before.filter(e=>e.section===c.section.id),field=key=>c.fields.find(f=>f.key===key),alpha=own.find(e=>e.field===field('name').id&&e.value==='Alpha').parent
 const roots=own.filter(e=>e.field===field('items').id&&!e.parent).sort((a,b)=>a.index-b.index),links=own.filter(e=>e.field===field('links').id&&e.parent===alpha).sort((a,b)=>a.index-b.index)
 await title.hover();await page.getByRole('button',{name:'Edit Block Content'}).click();const dialog=page.getByRole('dialog'),row=id=>dialog.locator('.RepeaterFieldItem[data-entry-id="'+id+'"]')
 assert.equal(await dialog.getByRole('button',{name:'Create Field',exact:true}).count(),0)
 await row(roots[1].id).getByRole('button',{name:'Move Item item up',exact:true}).click()
 if(!await row(alpha).locator('[id$="-name"] textarea').isVisible())await row(alpha).locator('button.title').first().click()
 await row(links[1].id).getByRole('button',{name:'Move Link item up',exact:true}).click();await dialog.getByRole('button',{name:'Save',exact:true}).click();await dialog.waitFor({state:'hidden'})
 for(let n=0;n<3;n++){await page.reload();await ready();const after=await c.verifyContent(tag);assert.equal(after.find(e=>e.id===roots[1].id).index,0);assert.equal(after.find(e=>e.id===links[1].id).index,0)}
 // Navigation cleanup is another detached presence task, separate from content.
 let cleanupAborted=false
 await page.route('**/api/collections/user_activities/records/*',async route=>{if(route.request().method()==='DELETE'){cleanupAborted=true;await route.abort('failed')}else await route.fallback()})
 await page.goto(c.origin+'/admin/dashboard/sites');await page.waitForSelector('.site-card-footer a');await delay(500)
 await c.verifyContent(tag);assert.equal(errors.length,0,c.redact(errors.join('\n')))
 assert.equal((await c.list('sites')).length,1,'Editor must not see the foreign site')
 Object.assign(report,{status:'PASS_PRESENCE_BROWSER',canceledPresenceUpdate:aborted,subsequentSuccessfulPresenceUpdates:recovered,cleanupAbortObserved:cleanupAborted,contentAndAllIdsRetained:true,rootAndNestedReorderRetained:true,abruptReloads:4})
 await fs.writeFile('presence-'+engine+'.json',JSON.stringify(report,null,2)+'\n');console.log(report)
})
