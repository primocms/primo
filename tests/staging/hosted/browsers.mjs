import {pathToFileURL} from 'node:url'
import {randomUUID} from 'node:crypto'
import {context,fs,path,invariant} from './lib.mjs'
const c=await context(),a=JSON.parse(await fs.readFile(path.join(c.run,'private/actors.json'),'utf8'))[2]
const client=await c.login(a.email,a.password)
const fields=(await c.ok('/api/collections/site_symbol_fields/records?perPage=200',{token:client.token})).items
const field=fields.find(f=>f.key==='heading'),entry=(await c.ok('/api/collections/page_section_entries/records?filter='+encodeURIComponent('section="'+a.sectionId+'" && field="'+field.id+'"'),{token:client.token})).items[0]
const onlyIndex=process.argv.indexOf('--only-browser'),only=onlyIndex>=0?process.argv[onlyIndex+1]:null
invariant(!only || ['Chrome','Edge','Firefox'].includes(only),'Unknown browser selector')
const engines=await import(pathToFileURL(path.join(c.kit,'tooling/node_modules/@playwright/test/index.mjs'))),cases=[]
for(const [label,engine,channel] of [['Chrome','chromium','chrome'],['Edge','chromium','msedge'],['Firefox','firefox',undefined]]) {
 if(only && label!==only)continue
 const result={browser:label,status:'FAIL',checks:[]},tag='QA live-update '+label+' '+randomUUID();let browser
 try {
  browser=await engines[engine].launch({headless:true,timeout:30000,...(channel?{channel}:{})});result.version=browser.version()
  const ctx=await browser.newContext({viewport:{width:1280,height:900}})
  await ctx.addInitScript(auth=>localStorage.setItem('pocketbase_auth',JSON.stringify(auth)),client)
  const first=await ctx.newPage(),second=await ctx.newPage(),errors=[]
  for(const p of [first,second]){p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push(e.message));await p.goto(c.state.cmsOrigin+'/admin/sites/'+a.siteId);await p.waitForFunction(()=>document.querySelector('main iframe[title=block]')?.contentDocument?.querySelector('h1[contenteditable=true]'),null,{timeout:90000})}
  const heading=first.locator('main iframe[title=block]').first().contentFrame().locator('h1[data-key=heading]')
  const saved=first.waitForResponse(r=>r.url().includes('/page_section_entries/records/'+entry.id)&&r.request().method()==='PATCH')
  await heading.fill(tag);await heading.blur();invariant((await saved).ok(),'Browser inline save rejected')
  await second.waitForFunction(text=>document.querySelector('main iframe[title=block]')?.contentDocument?.querySelector('h1')?.textContent===text,tag,{timeout:20000})
  const current=await c.ok('/api/collections/page_section_entries/records/'+entry.id,{token:client.token})
  for(const key of ['id','field','section','parent','locale'])invariant(current[key]===entry[key],'Cross-tab edit changed a binding')
  invariant(current.value===tag,'Browser edit not persisted')
  await c.patch('page_section_entries',entry.id,{value:entry.value},client.token)
  await second.waitForFunction(text=>document.querySelector('main iframe[title=block]')?.contentDocument?.querySelector('h1')?.textContent===text,entry.value,{timeout:20000})
  result.checks.push('Content-only editor inline save; second tab receives edit and restoration through live SSE without reload; identities retained')
  const publicPage=await ctx.newPage();publicPage.on('pageerror',e=>errors.push(e.message))
  await publicPage.addInitScript(()=>document.addEventListener('readystatechange',()=>{if(document.readyState==='interactive')window.originalQAHeadings=[...document.querySelectorAll('[data-primo-qa-heading]')]}))
  for(const width of [390,768,1280]) {
   await publicPage.setViewportSize({width,height:844});await publicPage.goto(c.state.cmsOrigin+'/')
   const counter=publicPage.locator('[data-primo-qa-counter]').first()
   for(let n=0;n<3;n++){if((await counter.textContent()).trim()==='Count 1')break;await counter.click();await counter.filter({hasText:'Count 1'}).waitFor({timeout:1500}).catch(()=>{})}
   invariant((await counter.textContent()).trim()==='Count 1','Published counter not interactive')
   invariant(await publicPage.evaluate(()=>window.originalQAHeadings.length===5&&window.originalQAHeadings.every((node,i)=>node===document.querySelectorAll('[data-primo-qa-heading]')[i])),'Public hydration replaced original headings')
   invariant(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow')
  }
  invariant(errors.length===0,'Runtime errors: '+errors.join('; '))
  await publicPage.screenshot({path:path.join(c.run,'evidence/public-'+label.toLowerCase()+'.png'),fullPage:true})
  result.checks.push('Public rendering, interaction, all five SSR headings retained and no horizontal overflow at 390/768/1280px; zero page errors')
  result.status='PASS_DESKTOP_AND_RESPONSIVE';result.physicalMobileDevice=false
  await ctx.close()
 }catch(error){result.failure=c.redact(error.stack)}
 finally{
  const current=await c.ok('/api/collections/page_section_entries/records/'+entry.id,{token:client.token})
  if(current.value===tag)await c.patch('page_section_entries',entry.id,{value:entry.value},client.token)
  else invariant(current.value===entry.value,'Unexpected concurrent non-canary heading edit; preserve it')
  await browser?.close();cases.push(result)
  const previous=only?await fs.readFile(path.join(c.run,'evidence/hosted-browsers.json'),'utf8').then(JSON.parse,()=>[]):[]
  await c.save('hosted-browsers.json',[...previous.filter(x=>x.browser!==label),...cases])
 }
 console.log(label+': '+result.status)
}
if(cases.some(x=>x.status==='FAIL'))process.exitCode=1
