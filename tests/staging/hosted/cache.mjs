import {pathToFileURL} from 'node:url'
import {context,fs,path,invariant,delay} from './lib.mjs'
const c=await context(),a=JSON.parse(await fs.readFile(path.join(c.run,'private/actors.json'),'utf8'))[0]
const builder=await c.login(c.credentials.builderEmail,c.credentials.builderPassword),editor=await c.login(a.email,a.password)
const section=await c.ok('/api/collections/page_sections/records/'+a.sectionId,{token:builder.token}),route='/api/collections/site_symbols/records/'+section.symbol
const original=await c.ok(route,{token:builder.token})
const oldColor='rgb(12, 34, 56)',newColor='rgb(5, 15, 25)',updates={}
for(const key of ['raw_source','css','html'])if(typeof original[key]==='string' && original[key].includes(oldColor))updates[key]=original[key].replaceAll(oldColor,newColor)
invariant(Object.keys(updates).length>0,'Known synthetic CSS color absent')
const {chromium}=await import(pathToFileURL(path.join(c.kit,'tooling/node_modules/@playwright/test/index.mjs')))
const browser=await chromium.launch({headless:true}),report={checks:[],status:'FAIL',productionChanged:false}
let changed=false
try {
 const ctx=await browser.newContext(),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
 const before=await c.api('/');await page.goto(c.state.cmsOrigin+'/')
 await page.waitForFunction(color=>getComputedStyle(document.querySelector('[data-primo-qa-heading]')).color===color,oldColor,{timeout:30000})
 const paths=await page.locator('script').evaluateAll(nodes=>nodes.map(x=>x.textContent).join('\n'))
 await c.patch('site_symbols',section.symbol,updates,builder.token);changed=true
 await delay(1100)
 await c.command(['publish','--server',c.state.cmsOrigin,'--site',a.siteId,'--token',editor.token,'--json'])
 await page.reload()
 await page.waitForFunction(color=>getComputedStyle(document.querySelector('[data-primo-qa-heading]')).color===color,newColor,{timeout:30000})
 const afterPaths=await page.locator('script').evaluateAll(nodes=>nodes.map(x=>x.textContent).join('\n'))
 invariant(paths!==afterPaths,'Publication did not version the changed script asset')
 // Use the browser's retained cache for the functional assertion; raw header
 // revalidation is captured separately below with an actual conditional fetch.
 const response=await fetch(c.state.cmsOrigin+'/',{redirect:'error',headers:{'If-Modified-Since':before.headers.get('last-modified')},signal:AbortSignal.timeout(20000)})
 invariant(response.status===200,'Old publication timestamp incorrectly returned 304 after republish')
 const counter=page.locator('[data-primo-qa-counter]').first()
 for(let n=0;n<3;n++){if((await counter.textContent()).trim()==='Count 1')break;await counter.click();await counter.filter({hasText:'Count 1'}).waitFor({timeout:1500}).catch(()=>{})}
 invariant((await counter.textContent()).trim()==='Count 1','Warm-cache republished site not interactive')
 invariant(errors.length===0,'Warm-cache browser runtime error')
 report.checks.push('Same browser retains cache across actual client CLI republication and receives updated CSS','Changed JavaScript asset URL/version observed','Old Last-Modified timestamp receives HTTP 200 after republish','Republished counter remains interactive with zero page errors')
 report.oldColor=oldColor;report.newColor=newColor;report.oldTimestamp=before.headers.get('last-modified');report.afterTimestamp=response.headers.get('last-modified');report.status='PASS_HOSTED_WARM_CACHE'
 await ctx.close()
}catch(error){report.failure=c.redact(error.stack)}
finally{
 if(changed) {
  const current=await c.ok(route,{token:builder.token})
  invariant(Object.entries(updates).every(([key,value])=>current[key]===value),'Unexpected concurrent source edit; preserve it')
  await c.patch('site_symbols',section.symbol,Object.fromEntries(Object.keys(updates).map(key=>[key,original[key]])),builder.token)
  await c.command(['publish','--server',c.state.cmsOrigin,'--site',a.siteId,'--token',editor.token,'--json'])
  report.sourceRestored=true
 }
 await browser.close();await c.save('hosted-cache.json',report);console.log(report.status);if(report.status==='FAIL')process.exitCode=1
}
