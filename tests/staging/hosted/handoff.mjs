import {randomBytes} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {context,fs,path,delay,invariant} from './lib.mjs'
const c=await context(),{run,state,evidence}=c
const actors=JSON.parse(await fs.readFile(path.join(run,'private/actors.json'),'utf8')),actor={...actors[0]}
const admin=await c.login(c.credentials.adminEmail,c.credentials.adminPassword,true)
const setupPassword=randomBytes(24).toString('base64url')+'Aa1!';c.secrets.add(setupPassword)
const freshUser=await c.create('users',{email:'handoff-'+randomBytes(6).toString('hex')+'@primo-qa.invalid',name:'Disposable handoff client',password:setupPassword,passwordConfirm:setupPassword,invite:'pending'},admin.token)
await c.create('site_role_assignments',{site:actor.siteId,user:freshUser.id,role:'editor'},admin.token)
Object.assign(actor,{email:freshUser.email,userId:freshUser.id,password:setupPassword})
const mailCredentials=JSON.parse(await fs.readFile(path.join(run,'private/mail.json'),'utf8'))
c.secrets.add(mailCredentials.password)
const mail=async route=>{
 const response=await fetch(new URL(route,state.mailOrigin),{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Basic '+Buffer.from(mailCredentials.username+':'+mailCredentials.password).toString('base64')}})
 invariant(response.ok,'Protected capture inbox request failed');return response.json()
}
let message
for(let n=0;n<30 && !message;n++){const inbox=await mail('/api/v1/messages');message=inbox.messages.find(m=>m.To?.some(r=>r.Address===actor.email));if(!message)await delay(200)}
invariant(message,'No actual SMTP invitation arrived in the controlled capture inbox')
const delivered=await mail('/api/v1/message/'+message.ID)
const invitation=(delivered.HTML || '').match(/href="([^"]+create=[^"]+)"/)?.[1].replaceAll('&amp;','&')
invariant(invitation && new URL(invitation).origin===state.cmsOrigin,'Invitation origin differs from staging')
const token=new URL(invitation).searchParams.get('create');invariant(token,'No invitation setup token');c.secrets.add(token)
const browserModule=await import(pathToFileURL(path.join(c.kit,'tooling/node_modules/@playwright/test/index.mjs')))
const browser=await browserModule.chromium.launch({headless:true})
let browserContext,page
const errors=[],publicErrors=[]
try {
 browserContext=await browser.newContext({viewport:{width:1280,height:900}})
 page=await browserContext.newPage();page.setDefaultTimeout(30000)
 await page.goto(invitation)
 await page.getByLabel('Password',{exact:true}).waitFor({state:'visible',timeout:30000})
 invariant(await page.getByLabel('Password',{exact:true}).isVisible(),'Real invitation URL did not render the account setup form')
 invariant(await page.getByRole('button',{name:'Create account',exact:true}).isVisible(),'Account setup action missing')
 // Complete synthetic token redemption through the public auth API, without GUI credential changes.
 const password=randomBytes(20).toString('hex')+'Aa1!';c.secrets.add(password)
 await c.ok('/api/collections/users/confirm-password-reset',{method:'POST',body:{token,password,passwordConfirm:password}})
 actor.password=password
 await c.save('handoff-client.json',actor,true)
 const client=await c.login(actor.email,password)
 invariant(client.record.id===actor.userId && !client.record.serverRole,'Wrong client identity or server-wide role')
 await page.addInitScript(auth=>localStorage.setItem('pocketbase_auth',JSON.stringify(auth)),client)
 await page.goto(state.cmsOrigin+'/admin/sites/'+actor.siteId)
 await page.waitForFunction(()=>{const f=[...document.querySelectorAll('main iframe[title=block]')];return f.length===5&&f.every(x=>x.contentDocument?.querySelector('h1'))},null,{timeout:90000})
 page.on('pageerror',error=>errors.push({message:error.message,stack:error.stack}))
 const fields=(await c.ok('/api/collections/site_symbol_fields/records?perPage=200',{token:client.token})).items
 const entries=()=>c.ok('/api/collections/page_section_entries/records?perPage=200',{token:client.token}).then(r=>r.items)
 const field=key=>fields.find(f=>f.key===key)
 const headingEntry=(await entries()).find(e=>e.section===actor.sectionId && e.field===field('heading').id)
 const heading=page.locator('main iframe[title=block]').first().contentFrame().locator('h1[data-key=heading]')
 const saved=page.waitForResponse(r=>r.url().includes('/page_section_entries/records/'+headingEntry.id)&&r.request().method()==='PATCH')
 await heading.click();await page.keyboard.press('ControlOrMeta+A');await page.keyboard.type('Client approved RC7 heading');await heading.blur()
 invariant((await saved).ok(),'Client inline save rejected')
 invariant((await c.ok('/api/collections/page_section_entries/records/'+headingEntry.id,{token:client.token})).value==='Client approved RC7 heading','Client heading not persisted')
 const before=await entries(),own=before.filter(e=>e.section===actor.sectionId),names=own.filter(e=>e.field===field('name').id)
 const alpha=names.find(e=>e.value==='Alpha').parent,bravo=names.find(e=>e.value==='Bravo').parent
 const originalRoots=own.filter(e=>e.field===field('items').id && !e.parent).sort((a,b)=>a.index-b.index)
 const rootToMove=originalRoots[1].id,expectedRoot=[originalRoots[1],originalRoots[0]].map(e=>names.find(n=>n.parent===e.id).value)
 const nested=own.filter(e=>e.field===field('links').id && e.parent===alpha).sort((a,b)=>a.index-b.index)
 const second=nested[1].id
 await heading.hover();await page.getByRole('button',{name:'Edit Block Content'}).click()
 const dialog=page.getByRole('dialog'),row=id=>dialog.locator('.RepeaterFieldItem[data-entry-id="'+id+'"]')
 invariant(await dialog.getByRole('button',{name:'Create Field',exact:true}).count()===0,'Content-only editor exposed schema creation')
 await row(rootToMove).getByRole('button',{name:'Move Item item up',exact:true}).click()
 if(!await row(alpha).locator('[id$="-name"] textarea').isVisible())await row(alpha).locator('button.title').first().click()
 await row(second).getByRole('button',{name:'Move Link item up',exact:true}).click()
 await dialog.getByRole('button',{name:'Save',exact:true}).click();await dialog.waitFor({state:'hidden'})
 await page.reload();await page.waitForFunction(()=>document.querySelector('main iframe[title=block]')?.contentDocument?.querySelector('h1'),null,{timeout:90000})
 const after=await entries()
 invariant(JSON.stringify(after.map(e=>e.id).sort())===JSON.stringify(before.map(e=>e.id).sort()),'Client reorder changed entry IDs')
 for(const old of before) {
  const current=after.find(e=>e.id===old.id)
  for(const key of ['field','section','parent','locale'])invariant(current[key]===old[key],'Client reorder changed a binding')
  if(!['group','repeater'].includes(fields.find(f=>f.id===old.field)?.type))invariant(JSON.stringify(current.value)===JSON.stringify(old.value),'Client reorder lost a leaf value')
 }
 const roots=after.filter(e=>e.field===field('items').id && e.section===actor.sectionId && !e.parent).sort((a,b)=>a.index-b.index)
 invariant(JSON.stringify(roots.map(e=>names.find(n=>n.parent===e.id).value))===JSON.stringify(expectedRoot),'Root reorder not retained')
 invariant(after.find(e=>e.id===second).index===0,'Nested reorder not retained')
 evidence.checks.push('Actual SMTP capture invitation, exact HTTPS setup form, token redemption via API, client auth, inline edit, root/nested reorder, Save/reload and complete entry identity/leaf-value retention')
 const activated=page.waitForResponse(r=>r.url().includes('/api/primo/publication/')&&r.url().endsWith('/activate')&&r.request().method()==='POST',{timeout:90000})
 await page.getByRole('button',{name:/^(Preview|Publish)$/}).click()
 const confirm=page.getByRole('dialog').getByRole('button',{name:/publish|preview|confirm/i}).first()
 if(await confirm.isVisible({timeout:2000}).catch(()=>false))await confirm.click()
 invariant((await activated).ok(),'Client browser publication failed')
 invariant((await c.api('/')).text.includes('Client approved RC7 heading'),'Browser publication did not reach actual ingress')
 await c.command(['publish','--server',state.cmsOrigin,'--site',actor.siteId,'--token',client.token,'--json'])
 const published=await browserContext.newPage();published.on('pageerror',e=>publicErrors.push({message:e.message,stack:e.stack}))
 await published.addInitScript(()=>document.addEventListener('readystatechange',()=>{if(document.readyState==='interactive')window.originalQAHeadings=[...document.querySelectorAll('[data-primo-qa-heading]')]}))
 await published.goto(state.cmsOrigin+'/')
 invariant(await published.locator('[data-primo-qa-heading]').first().textContent()==='Client approved RC7 heading','Published client text is stale')
 const counter=published.locator('[data-primo-qa-counter]').first()
 for(let attempt=0;attempt<3;attempt++){if((await counter.textContent()).trim()==='Count 1')break;await counter.click();await counter.filter({hasText:'Count 1'}).waitFor({timeout:1500}).catch(()=>{})}
 invariant((await counter.textContent()).trim()==='Count 1','Published counter did not become interactive')
 invariant(await published.evaluate(()=>window.originalQAHeadings.length===5 && window.originalQAHeadings.every((node,i)=>node===document.querySelectorAll('[data-primo-qa-heading]')[i])),'Published hydration replaced SSR headings')
 invariant(publicErrors.length===0 && errors.length===0,'Browser runtime errors occurred')
 await published.screenshot({path:path.join(run,'evidence/hosted-client-publication.png'),fullPage:true})
 evidence.checks.push('Content-only client publishes through exact CMS browser compiler and exact installed CLI; public HTTPS content, counter interaction and all five original SSR heading nodes retained')
 const config=JSON.parse(await fs.readFile(path.join(run,'private/staging.local.json'),'utf8'));config.publicPages[0].headings[0]='Client approved RC7 heading';await c.save('staging.local.json',config,true)
 evidence.status='PASS_HOSTED_CLIENT_HANDOFF';evidence.browser={name:'chromium',version:browser.version()};evidence.mailScope='Private capture SMTP only; ordinary provider AUTH/TLS and inbox deliverability remain unverified';evidence.accountSetup='Actual emailed HTTPS link/form; setup token redeemed using public API; browser session then verifies client access'
 await c.save('handoff.json',evidence)
 console.log('PASS hosted client invitation, nested reorder, browser and exact CLI republication, public hydration and interaction')
}catch(error){
 await page?.screenshot({path:path.join(run,'private/handoff-failure.png'),fullPage:true}).catch(()=>{})
 const diagnostic={failure:c.redact(error.stack),errors,publicErrors,page:await page?.evaluate(()=>({path:location.pathname,text:document.body.innerText.slice(0,2000)})).catch(()=>null)}
 await c.save('handoff-failure.json',diagnostic,true);console.error(c.redact(error.stack));process.exitCode=1
}finally{await browserContext?.close();await browser.close()}
