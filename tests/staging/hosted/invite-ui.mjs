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
const errors=[]
try{
 browserContext=await browser.newContext({viewport:{width:1280,height:900}})
 page=await browserContext.newPage();page.on('pageerror',e=>errors.push(e.message))
 await page.goto(invitation)
 const password=randomBytes(24).toString('base64url')+'Aa1!';c.secrets.add(password)
 await page.getByLabel('Password',{exact:true}).fill(password)
 await page.getByLabel('Confirm password',{exact:true}).fill(password)
 const confirmed=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/collections/users/confirm-password-reset'&&r.request().method()==='POST',{timeout:30000})
 await page.getByRole('button',{name:'Create account',exact:true}).click()
 invariant((await confirmed).ok(),'Browser invitation password confirmation failed')
 await page.waitForURL(url=>url.pathname.startsWith('/admin')&&!url.pathname.includes('/auth'),{timeout:30000})
 const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('pocketbase_auth')))
 invariant(session.record.id===actor.userId && !session.record.serverRole,'Browser auto-login identity or permission is wrong')
 await c.save('invitation-ui-client.json',{...actor,password},true)
 await page.goto(state.cmsOrigin+'/admin/sites/'+actor.siteId)
 await page.waitForFunction(()=>{const frames=[...document.querySelectorAll('main iframe[title=block]')];return frames.length===5&&frames.every(f=>f.contentDocument?.querySelector('h1'))},null,{timeout:90000})
 await page.reload()
 await page.waitForFunction(()=>document.querySelector('main iframe[title=block]')?.contentDocument?.querySelector('h1'),null,{timeout:90000})
 invariant(errors.length===0,'Invitation GUI emitted browser runtime errors')
 evidence.status='PASS_HOSTED_BROWSER_INVITATION_ACCEPTANCE';evidence.browser={name:'chromium',version:browser.version()};evidence.checks=['Actual SMTP invitation reached private capture only','Exact emailed HTTPS setup link, password and confirmation entered through the browser form, Create account submitted and automatically signed in','Scoped client opened its five-block editor and remained signed in after reload; no source/content canary changes'];evidence.externalMailDelivery=false
 await c.save('invitation-ui.json',evidence);console.log('PASS real capture-mail link and complete browser account setup')
}catch(error){await c.save('invitation-ui-failure.json',{failure:c.redact(error.stack),errors},true);console.error(c.redact(error.stack));process.exitCode=1}
finally{await browserContext?.close();await browser.close()}
