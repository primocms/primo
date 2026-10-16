import {setTimeout as delay} from 'node:timers/promises'
import {pathToFileURL} from 'node:url'
import {options,loadConfig,configIssues,printPlan,verifyTarget,privateReport,origin,publicUrl,resolveEnv,invariant,safeError} from './lib.mjs'

export function webdriver(d,timeout,env=process.env) {
 const endpoint=new URL(env[d.transportUrlEnv]);origin(endpoint.href)
 invariant(!endpoint.search && !endpoint.hash,'WebDriver endpoint must not have query parameters')
 const base=endpoint.href.replace(/\/$/,'')
 const auth=d.usernameEnv?{Authorization:'Basic '+Buffer.from(env[d.usernameEnv]+':'+env[d.passwordEnv]).toString('base64')}:{}
 return async function command(method,route,body) {
  const response=await fetch(base+route,{method,redirect:'error',signal:AbortSignal.timeout(timeout),headers:{'Content-Type':'application/json',...auth},body:body===undefined?undefined:JSON.stringify(body)})
  const data=await response.json()
  invariant(response.ok && !data.value?.error,'WebDriver command failed; credentials and provider responses are omitted')
  return data.value
 }
}
// Read the visible DOM in the actual browser. No CSS, HTML or runtime source is patched.
const snapshotScript=`
const roots=[...document.querySelectorAll('[data-primo-launch-fixture]')];
const headings=[...document.querySelectorAll('[data-primo-qa-heading]')];
const button=document.querySelector('[data-primo-qa-counter]');
const visible=headings.every(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'});
return {markers:roots.map(el=>el.getAttribute('data-primo-launch-fixture')),headings:headings.map(el=>el.textContent.trim()),visible,counter:button?.textContent.trim(),width:innerWidth,scrollWidth:document.documentElement.scrollWidth,ready:document.readyState,platform:navigator.platform,userAgent:navigator.userAgent};`
export async function deviceProbe(c,d,{env=process.env}={}) {
 const result={kind:'device-public-probe',device:d.name,status:'FAIL',physicalDeviceAttested:d.physical===true,pages:[],published:false,deployed:false,mailSent:false,editorGate:'NOT_RUN',publicationGate:'NOT_RUN'}
 const command=webdriver(d,Math.max(c.requestTimeoutMs,60000),env)
 let session
 try {
  result.target=await verifyTarget(c)
  const opened=await command('POST','/session',{capabilities:{alwaysMatch:{...resolveEnv(d.capabilities,env),pageLoadStrategy:'normal'}}})
  invariant(typeof opened.sessionId==='string' && opened.sessionId.length>0,'No WebDriver session')
  session='/session/'+encodeURIComponent(opened.sessionId)
  const capabilities=opened.capabilities || {}
  result.browser={name:capabilities.browserName,version:capabilities.browserVersion,platform:capabilities.platformName,platformVersion:capabilities.platformVersion ?? capabilities['appium:platformVersion'] ?? null}
  invariant(String(capabilities.browserName).toLowerCase()===String(d.capabilities.browserName).toLowerCase(),'Unexpected browser returned')
  const platform=String(capabilities.platformName).toLowerCase(),requested=String(d.capabilities.platformName).toLowerCase()
  invariant(platform===requested || (['mac','macos'].includes(platform)&&['mac','macos'].includes(requested)),'Unexpected device platform returned')
  await command('POST',session+'/timeouts',{implicit:0,pageLoad:60000,script:c.requestTimeoutMs})
  for(let index=0;index<c.publicPages.length;index++) {
   const p=c.publicPages[index],expected=publicUrl(p.url)
   await command('POST',session+'/url',{url:p.url})
   invariant(origin(await command('GET',session+'/url'))===expected.origin,'Browser navigated outside the staging origin; no interaction attempted')
   let snapshot
   const end=performance.now()+Math.max(c.requestTimeoutMs,30000)
   do {
    snapshot=await command('POST',session+'/execute/sync',{script:snapshotScript,args:[]})
    if(snapshot.ready==='complete' && snapshot.headings?.length===5)break
    await delay(200)
   }while(performance.now()<end)
   invariant(snapshot.markers?.length===5 && snapshot.markers.every(x=>x===c.environmentId),'Published QA markers are missing')
   invariant(JSON.stringify(snapshot.headings)===JSON.stringify(p.headings) && snapshot.visible,'Device heading rendering differs')
   invariant(snapshot.width>0 && snapshot.scrollWidth<=snapshot.width,'Horizontal overflow on the actual viewport')
   invariant(snapshot.counter==='Count 0','Counter fixture is not fresh')
   await command('POST',session+'/execute/sync',{script:"window.__primoQAHeadingNodes=[...document.querySelectorAll('[data-primo-qa-heading]')];return true",args:[]})
   const element=await command('POST',session+'/element',{using:'css selector',value:'[data-primo-qa-counter]'})
   const id=element['element-6066-11e4-a52e-4f735466cecf'];invariant(typeof id==='string','No native counter element')
   await command('POST',session+'/element/'+encodeURIComponent(id)+'/click',{})
   let after
   const until=performance.now()+c.requestTimeoutMs
   do {after=await command('POST',session+'/execute/sync',{script:snapshotScript,args:[]});if(after.counter==='Count 1')break;await delay(200)}while(performance.now()<until)
   invariant(after.counter==='Count 1' && JSON.stringify(after.headings)===JSON.stringify(p.headings),'Published interaction or content failed')
   invariant(await command('POST',session+'/execute/sync',{script:"return window.__primoQAHeadingNodes.every((node,i)=>node===document.querySelectorAll('[data-primo-qa-heading]')[i])",args:[]})===true,'Interaction replaced existing headings')
   result.pages.push({index,headings:after.headings,viewportWidth:after.width,scrollWidth:after.scrollWidth,counter:'Count 1',existingDOMRetainedDuringInteraction:true})
   await command('POST',session+'/refresh',{})
   invariant(origin(await command('GET',session+'/url'))===expected.origin,'Browser reload escaped the staging origin')
   let reloaded
   const reloadEnd=performance.now()+Math.max(c.requestTimeoutMs,30000)
   do {reloaded=await command('POST',session+'/execute/sync',{script:snapshotScript,args:[]});if(reloaded.ready==='complete' && reloaded.headings?.length===5)break;await delay(200)}while(performance.now()<reloadEnd)
   invariant(reloaded.markers?.length===5 && reloaded.markers.every(x=>x===c.environmentId) && reloaded.visible && reloaded.counter==='Count 0' && JSON.stringify(reloaded.headings)===JSON.stringify(p.headings),'Reload lost content or interaction state did not reset')
  }
  result.status='PASS_PUBLIC_SMOKE_ONLY'
 }catch(e){result.failure=safeError(e)}
 finally {
  if(session)try{await command('DELETE',session);result.sessionClosed=true}catch{result.sessionClosed=false;result.status='FAIL';result.failure='webdriver-session-cleanup-failed'}
 }
 result.note='Hardware status is an operator attestation, not detected by this script. Mobile emulation does not clear physical-device gates. Editor invitation, keyboard/focus, content/repeater save/reload and authorized republication require DEVICE-CHECKLIST.md. Initial SSR-node hydration identity is covered by the frozen package handoff, not claimed here.'
 return result
}
async function main() {
 const o=options();if(o.help){console.log('node device.mjs --config staging.local.json --device mac-safari|iphone-safari|android-chrome [--run]\nUses an existing W3C WebDriver service; never enables Safari settings, installs apps, sends mail or publishes. Default: no network.');return}
 const c=await loadConfig(o.config),issues=configIssues(c,{device:o.device})
 if(!o.run || issues.length){process.exitCode=printPlan(c,issues,'device');return}
 const d=c.devices.find(x=>x.name===o.device),result=await deviceProbe(c,d),file=await privateReport(c,'device',result)
 console.log(JSON.stringify({status:result.status,evidence:file}));process.exitCode=result.status.startsWith('PASS')?0:1
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Configuration or local evidence failure; secrets are not printed.');process.exitCode=2})
