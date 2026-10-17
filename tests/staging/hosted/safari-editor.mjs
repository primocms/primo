import fs from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {pathToFileURL} from 'node:url'
import {loadConfig,verifyTarget,privateReport,safeError,invariant} from '../launch/lib.mjs'
import {webdriver} from '../launch/device.mjs'
export function validateSafariActor(actor,c){
 invariant(actor?.cmsOrigin===c.cmsOrigin && actor.environmentId===c.environmentId,'Editor secret belongs to a different disposable target')
 invariant(typeof actor.email==='string' && /^safari-ci-[a-f0-9]+@primo-qa\.invalid$/.test(actor.email) && typeof actor.password==='string' && actor.password.length>=24,'Only a freshly generated Safari QA account is allowed')
 invariant(['siteId','sectionId','userId'].every(key=>/^[a-z0-9]{15}$/.test(actor[key] || '')),'Invalid scoped QA identity')
}
export async function safariEditor(c,actor,env=process.env){
 validateSafariActor(actor,c)
 await verifyTarget(c)
 const report={kind:'actual-safari-editor-handoff',status:'FAIL',checks:[],cleanup:[],physicalDevice:false,mailScope:'Separate capture-mail invitation test; this runner uses a temporary scoped account',productionChanged:false}
 const api=async(route,{method='GET',body,token}={})=>{
  const r=await fetch(new URL(route,c.cmsOrigin),{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  invariant(r.ok,'Scoped QA API failed: '+method+' '+route.split('?')[0]+' HTTP '+r.status)
  return r.status===204?null:r.json()
 }
 const auth=await api('/api/collections/users/auth-with-password',{method:'POST',body:{identity:actor.email,password:actor.password}})
 invariant(auth.record.id===actor.userId && !auth.record.serverRole,'Safari QA user has unexpected server permissions')
 const memberships=await api('/api/collections/site_role_assignments/records?perPage=200',{token:auth.token})
 invariant(memberships.items.length===1 && memberships.items[0].site===actor.siteId && memberships.items[0].role==='editor','Safari QA account is not scoped to one content-only site')
 const entries=()=>api('/api/collections/page_section_entries/records?perPage=500',{token:auth.token}).then(x=>x.items)
 const fields=(await api('/api/collections/site_symbol_fields/records?perPage=200',{token:auth.token})).items
 const field=key=>fields.find(f=>f.key===key),before=await entries(),own=before.filter(e=>e.section===actor.sectionId)
 invariant(own.find(e=>e.field===field('qa_scratch').id)?.value==='QA scratch agency-01','Exclusive source soak must be complete before Safari editor mutations')
 const heading=own.find(e=>e.field===field('heading').id),names=own.filter(e=>e.field===field('name').id)
 const alpha=names.find(e=>e.value==='Alpha').parent,roots=own.filter(e=>e.field===field('items').id && !e.parent).sort((a,b)=>a.index-b.index),nested=own.filter(e=>e.field===field('links').id && e.parent===alpha).sort((a,b)=>a.index-b.index)
 invariant(roots.length===2 && nested.length===2,'Expected nested QA fixture missing')
 const moved=[...roots,...nested],expectedIndices=new Map(moved.map(e=>[e.id,e.index===0?1:0])),tag='Safari verified '+randomUUID()
 const cmd=webdriver(c.devices[0],60000,env);let session,published=false
 const execute=(script,args=[])=>cmd('POST',session+'/execute/sync',{script,args})
 const wait=async(fn,label,ms=90000)=>{const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await delay(250)}invariant(false,label)}
 const element=async(selector)=>{const e=await cmd('POST',session+'/element',{using:'css selector',value:selector});return e['element-6066-11e4-a52e-4f735466cecf']}
 const click=id=>cmd('POST',session+'/element/'+encodeURIComponent(id)+'/click',{})
 const type=(id,text)=>cmd('POST',session+'/element/'+encodeURIComponent(id)+'/value',{text})
 const button=async(label)=>{const e=await execute("return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()===arguments[0] || b.getAttribute('aria-label')===arguments[0])",[label]);invariant(e,'Expected editor button absent');return e['element-6066-11e4-a52e-4f735466cecf']}
 try{
  report.phase='open-safari';const opened=await cmd('POST','/session',{capabilities:{alwaysMatch:{browserName:'safari',platformName:'mac',pageLoadStrategy:'normal'}}});session='/session/'+encodeURIComponent(opened.sessionId);report.browser=opened.capabilities
  await cmd('POST',session+'/timeouts',{implicit:0,pageLoad:60000,script:15000})
  report.phase='native-sign-in';await cmd('POST',session+'/url',{url:c.cmsOrigin+'/admin/auth'})
  await wait(()=>execute("return !!document.querySelector('input[type=email]')"),'Safari sign-in form missing')
  await type(await element('input[type=email]'),actor.email);await type(await element('input[type=password]'),actor.password);await click(await element('button[type=submit]'))
  await wait(async()=>{const url=new URL(await cmd('GET',session+'/url'));return url.pathname.startsWith('/admin')&&!url.pathname.includes('/auth')},'Safari native sign-in did not complete')
  await cmd('POST',session+'/url',{url:c.cmsOrigin+'/admin/sites/'+actor.siteId})
  await wait(()=>execute("const f=document.querySelector('main iframe[title=block]');return !!f?.contentDocument?.querySelector('h1[contenteditable=true]')"),'Safari editor blocks did not become editable')
  report.phase='native-heading-edit';const frame=await element('main iframe[title=block]');await cmd('POST',session+'/frame',{id:{'element-6066-11e4-a52e-4f735466cecf':frame}})
  const h=await element('h1[data-key=heading]');await click(h);await cmd('POST',session+'/element/'+encodeURIComponent(h)+'/clear',{});await type(h,tag);await type(h,'\uE004')
  await wait(async()=>(await api('/api/collections/page_section_entries/records/'+heading.id,{token:auth.token})).value===tag,'Safari native heading edit did not persist')
  await cmd('POST',session+'/frame',{id:null});await cmd('POST',session+'/refresh',{})
  await wait(()=>execute("return document.querySelector('main iframe[title=block]')?.contentDocument?.querySelector('h1')?.textContent===arguments[0]",[tag]),'Safari edit lost after reload')
  report.phase='nested-repeater';const f2=await element('main iframe[title=block]');await cmd('POST',session+'/frame',{id:{'element-6066-11e4-a52e-4f735466cecf':f2}})
  const hover=await element('h1[data-key=heading]');await cmd('POST',session+'/actions',{actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:100,origin:{'element-6066-11e4-a52e-4f735466cecf':hover},x:0,y:0}]}]})
  await cmd('POST',session+'/frame',{id:null});await click(await button('Edit Block Content'))
  await wait(()=>execute("return !!document.querySelector('[role=dialog] .RepeaterFieldItem')"),'Safari content dialog missing')
  invariant(await execute("return ![...document.querySelectorAll('[role=dialog] button')].some(b=>b.textContent.trim()==='Create Field')"),'Editor exposed schema creation')
  const row=id=>'[role=dialog] .RepeaterFieldItem[data-entry-id="'+id+'"]'
  await click(await element(row(roots[1].id)+' button[aria-label="Move Item item up"]'))
  if(!await execute("const x=document.querySelector(arguments[0]+' textarea');return !!x&&x.getClientRects().length>0",[row(alpha)]))await click(await element(row(alpha)+' button.title'))
  await click(await element(row(nested[1].id)+' button[aria-label="Move Link item up"]'))
  await click(await button('Save'));await wait(()=>execute("return !document.querySelector('[role=dialog]')"),'Safari content save did not finish')
  await cmd('POST',session+'/refresh',{});await wait(()=>execute("return !!document.querySelector('main iframe[title=block]')?.contentDocument?.querySelector('h1')"),'Safari reload failed')
  const after=await entries();invariant(JSON.stringify(after.map(e=>e.id).sort())===JSON.stringify(before.map(e=>e.id).sort()),'Safari reorder changed record identities')
  for(const old of before){const current=after.find(e=>e.id===old.id);for(const key of ['field','section','parent','locale'])invariant(current[key]===old[key],'Safari reorder changed a binding');if(!['group','repeater'].includes(fields.find(f=>f.id===old.field)?.type))invariant(JSON.stringify(current.value)===JSON.stringify(old.id===heading.id?tag:old.value),'Safari reorder lost a leaf value')}
  for(const e of moved)invariant(after.find(x=>x.id===e.id).index===expectedIndices.get(e.id),'Safari nested/root order not persisted')
  report.checks.push('Native Safari sign-in, keyboard heading edit, save and reload','Native root/nested repeater move buttons, Save/reload, all IDs/bindings/leaf values retained; schema creation absent')
  report.phase='browser-publication';await click(await button('Publish'))
  await delay(500)
  const confirm=await execute("const d=document.querySelector('[role=dialog]');return d&&[...d.querySelectorAll('button')].find(b=>/publish|confirm/i.test(b.textContent))")
  if(confirm)await click(confirm['element-6066-11e4-a52e-4f735466cecf'])
  await wait(async()=>{const r=await fetch(c.cmsOrigin+'/');return (await r.text()).includes(tag)},'Safari browser publication did not reach public ingress');published=true
  report.phase='public-interaction';await cmd('POST',session+'/url',{url:c.cmsOrigin+'/'})
  await wait(()=>execute("return document.querySelector('[data-primo-qa-heading]')?.textContent===arguments[0]",[tag]),'Safari public text stale')
  const counter=await element('[data-primo-qa-counter]');await click(counter)
  await wait(()=>execute("return document.querySelector('[data-primo-qa-counter]')?.textContent==='Count 1'"),'Safari public counter not interactive',15000)
  report.checks.push('Actual Safari CMS browser-compiler publication reaches HTTPS; published client text and native counter interaction pass')
  report.status='PASS_SAFARI_EDITOR_HANDOFF'
 }catch(e){
  report.failure=safeError(e)
  if(session)try{
   await cmd('POST',session+'/frame',{id:null})
   report.diagnostic=await execute("const a=JSON.parse(localStorage.getItem('pocketbase_auth')||'null');return {path:location.pathname,ready:document.readyState,text:document.body.innerText.slice(0,1600),auth:{present:!!a?.token,userId:a?.record?.id,serverRole:a?.record?.serverRole},frames:[...document.querySelectorAll('iframe')].map(f=>({title:f.title,src:f.getAttribute('src'),hasDocument:!!f.contentDocument,text:f.contentDocument?.body?.innerText?.slice(0,300),heading:f.contentDocument?.querySelector('h1')?.outerHTML?.slice(0,600)}))}")
   report.diagnostic.text=report.diagnostic.text.replaceAll(actor.email,'[QA account]')
   await fs.mkdir('safari-results',{recursive:true})
   await fs.writeFile('safari-results/safari-editor-failure.png',Buffer.from(await cmd('GET',session+'/screenshot'),'base64'))
  }catch{report.diagnosticUnavailable=true}
 }
 finally{
  try{
   const current=await entries(),h=current.find(e=>e.id===heading.id)
   invariant(h.value===heading.value || h.value===tag,'Another writer changed heading; preserve it')
   if(h.value===tag)await api('/api/collections/page_section_entries/records/'+heading.id,{method:'PATCH',token:auth.token,body:{value:heading.value}})
   for(const old of moved){const record=current.find(e=>e.id===old.id);invariant(record.index===old.index || record.index===expectedIndices.get(old.id),'Another writer changed order; preserve it');if(record.index!==old.index)await api('/api/collections/page_section_entries/records/'+old.id,{method:'PATCH',token:auth.token,body:{index:old.index}})}
   const restored=await entries();for(const old of before){const r=restored.find(e=>e.id===old.id);invariant(r && r.field===old.field && r.parent===old.parent && r.section===old.section && r.locale===old.locale && r.index===old.index,'Safari cleanup identity/order differs');if(!['group','repeater'].includes(fields.find(f=>f.id===old.field)?.type))invariant(JSON.stringify(r.value)===JSON.stringify(old.value),'Safari cleanup leaf differs')}
   report.cleanup.push('All original content IDs, bindings, leaf values and indices verified after conditional restoration')
  }catch(e){report.status='FAIL';report.cleanupFailure=safeError(e)}
  if(session)try{await cmd('DELETE',session);report.sessionClosed=true}catch{report.status='FAIL';report.sessionClosed=false}
 }
 report.requiresLocalCliCleanupPublication=published
 return report
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 invariant(process.env.GITHUB_ACTIONS==='true','Use only the disposable CI runner')
 const c=await loadConfig('safari.local.json'),result=await safariEditor(c,JSON.parse(process.env.PRIMO_QA_SAFARI_EDITOR || '{}'))
 const evidence=await privateReport(c,'safari-editor',result);console.log(JSON.stringify({status:result.status,evidence}));process.exitCode=result.status==='PASS_SAFARI_EDITOR_HANDOFF'?0:1
}
