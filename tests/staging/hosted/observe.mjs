import {pathToFileURL} from 'node:url'
import {context,fs,path,delay,invariant} from './lib.mjs'
const c=await context(),actors=JSON.parse(await fs.readFile(path.join(c.run,'private/actors.json'),'utf8')),a=actors[0]
const auth=await c.login(a.email,a.password),{chromium}=await import(pathToFileURL(path.join(c.kit,'tooling/node_modules/@playwright/test/index.mjs')))
const browser=await chromium.launch({headless:true}),report={events:[],checks:[]}
try {
 const ctx=await browser.newContext(),page=await ctx.newPage()
 let phase='load'
 page.on('pageerror',e=>report.events.push({phase,kind:'pageerror',message:e.message,stack:e.stack}))
 page.on('response',r=>{if(r.status()>=400){const u=new URL(r.url());report.events.push({phase,kind:'http-error',origin:u.origin,path:u.pathname,status:r.status()})}})
 page.on('requestfailed',r=>{const u=new URL(r.url());report.events.push({phase,kind:'network-error',origin:u.origin,path:u.pathname,error:r.failure()?.errorText})})
 page.on('console',m=>{if(m.type()==='error')report.events.push({phase,kind:'console',message:m.text()})})
 await page.addInitScript(auth=>localStorage.setItem('pocketbase_auth',JSON.stringify(auth)),auth)
 await page.goto(c.state.cmsOrigin+'/admin/sites/'+a.siteId)
 await page.waitForFunction(()=>{const f=[...document.querySelectorAll('main iframe[title=block]')];return f.length===5&&f.every(x=>x.contentDocument?.querySelector('h1'))},null,{timeout:90000})
 await delay(1000);report.checks.push('all five editor blocks rendered')
 await c.save('realtime-load-observation.json',report)
 invariant(report.events.length===0,'Editor load produced browser errors')
 await ctx.close()
}catch(e){report.failure=c.redact(e.stack);process.exitCode=1}finally{await browser.close();await c.save('realtime-load-observation.json',report);console.log(c.redact(JSON.stringify(report,null,2)))}
