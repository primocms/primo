import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {randomUUID} from 'node:crypto'

export const candidate = JSON.parse(await fs.readFile(new URL('./candidate.json', import.meta.url), 'utf8'))
export const here = path.dirname(fileURLToPath(import.meta.url))
export class CheckError extends Error { constructor(message) { super(message); this.name='CheckError' } }
export function invariant(ok, message) { if (!ok) throw new CheckError(message) }
export function placeholder(value) { return typeof value !== 'string' || !value.trim() || /REPLACE|example\.(test|com)|YOUR_|<[^>]+>/i.test(value) }
export function options(argv = process.argv.slice(2)) {
 const result = {run:false, help:false, config:'staging.local.json', profile:'read', device:'mac-safari'}
 for (let i=0;i<argv.length;i++) {
  const key=argv[i]
  if(key==='--run') result.run=true
  else if(key==='--help') result.help=true
  else if(['--config','--profile','--device'].includes(key)) { invariant(argv[i+1] && !argv[i+1].startsWith('--'),'Missing option value'); result[key.slice(2)]=argv[++i] }
  else throw new Error('Unknown option; use --help')
 }
 invariant(['read','edit'].includes(result.profile),'Profile must be read or edit')
 return result
}
export function origin(value) {
 const u=new URL(value)
 invariant(!u.username && !u.password && !u.hash,'URLs must not contain credentials or fragments')
 invariant(u.protocol==='https:' || (u.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(u.hostname)),'HTTPS is required except on loopback')
 return u.origin
}
export function publicUrl(value) {
 const u=new URL(value)
 origin(u.href)
 invariant(![...u.searchParams.keys()].some(k=>/token|password|secret|key|auth/i.test(k)),'No credentials in URLs')
 return u
}
export async function loadConfig(filename) {
 const full=path.resolve(filename)
 const config=JSON.parse(await fs.readFile(full,'utf8'))
 config.baseDirectory=path.dirname(full)
 return config
}
export function configIssues(c, {profile='read', device=null, env=process.env}={}) {
 const issues=[]
 const check=(condition,name)=>{if(!condition)issues.push(name)}
 check(c.disposable===true,'disposable must be true')
 check(!placeholder(c.environmentId) && /^[a-zA-Z0-9_-]{12,100}$/.test(c.environmentId),'environmentId: supply a unique disposable-environment marker')
 try {check(!placeholder(c.cmsOrigin) && origin(c.cmsOrigin)===c.cmsOrigin,'cmsOrigin: supply an exact origin without path')} catch {issues.push('cmsOrigin: invalid or insecure origin')}
 try {check(c.cmsProbePath?.startsWith('/') && !c.cmsProbePath.startsWith('//') && new URL(c.cmsProbePath,c.cmsOrigin).origin===c.cmsOrigin && !placeholder(c.cmsProbePath) && /^[a-z0-9]{15}$/.test(new URL(c.cmsProbePath,c.cmsOrigin).searchParams.get('_site') || ''),'cmsProbePath: supply the marked QA _site preview on the CMS origin')} catch {issues.push('cmsProbePath: invalid')}
 check(Array.isArray(c.publicPages) && c.publicPages.length>0 && c.publicPages.length<=20,'publicPages: 1–20 explicit QA URLs required')
 for(const p of c.publicPages || []) {
  try {check(!placeholder(p.url) && !!publicUrl(p.url),'publicPages: replace URL placeholders')} catch {issues.push('publicPages: invalid URL')}
  check(Array.isArray(p.headings) && p.headings.length===5 && p.headings.every(x=>typeof x==='string' && x.length>0),'publicPages: five expected fixture headings required')
 }
 check(Number.isInteger(c.requestTimeoutMs) && c.requestTimeoutMs>=100 && c.requestTimeoutMs<=60000,'requestTimeoutMs: 100–60000 required')
 check(typeof c.outputDirectory==='string' && c.outputDirectory.length>0,'outputDirectory required')
 const s=c.soak || {}
 check(Number.isInteger(s.durationSeconds) && s.durationSeconds>=1 && s.durationSeconds<=86400,'soak.durationSeconds: 1–86400 required')
 check(Number.isInteger(s.workers) && s.workers>=1 && s.workers<=20,'soak.workers: 1–20 required')
 check(Number.isInteger(s.intervalMs) && s.intervalMs>=1000 && s.intervalMs<=60000,'soak.intervalMs: 1000–60000 required')
 check(Number.isInteger(s.maxRequests) && s.maxRequests>=1 && s.maxRequests<=100000,'soak.maxRequests: 1–100000 required')
 for(const k of ['p95PublicMs','p95SaveRoundtripMs'])check(Number.isFinite(s[k]) && s[k]>0,'soak.'+k+': positive limit required')
 check(Number.isFinite(s.maxErrorRate) && s.maxErrorRate>=0 && s.maxErrorRate<=1,'soak.maxErrorRate: 0–1 required')
 check(Number.isInteger(s.minimumGateSeconds) && s.minimumGateSeconds>=3600 && s.minimumGateSeconds<=86400,'soak.minimumGateSeconds: at least 3600 required')
 if(profile==='edit') {
  const loginMs=s.loginIntervalMs ?? 1700
  check(Number.isInteger(loginMs) && loginMs>=0 && loginMs<=60000,'soak.loginIntervalMs: 0–60000 required')
  let local=false;try{local=['127.0.0.1','localhost','[::1]'].includes(new URL(c.cmsOrigin).hostname)}catch{}
  check(local || loginMs>=1600,'soak.loginIntervalMs: remote setup must respect production auth throttling (at least 1600 ms)')
  check(s.exclusiveScratchRecords===true,'soak.exclusiveScratchRecords: reserve the synthetic records exclusively for this run')
  check(Array.isArray(c.actors) && c.actors.length===s.workers && c.actors.length<=20,'actors: exactly one per edit worker required')
  for(const key of ['name','siteId','userId','entryId'])check(new Set((c.actors || []).map(a=>a[key])).size===(c.actors || []).length,'actors: unique '+key+' required')
  for(const a of c.actors || []) {
   check(/^[a-zA-Z0-9_-]+$/.test(a.name),'actor name must be a simple alias')
   for(const key of ['userId','siteId','pageId','sectionId','fieldId','entryId'])check(/^[a-z0-9]{15}$/.test(a[key]),a.name+': supply '+key)
   for(const key of ['emailEnv','passwordEnv'])check(/^[A-Z][A-Z0-9_]+$/.test(a[key]) && !placeholder(env[a[key]]),a.name+': supply environment variable '+a[key])
   check(a.expectedOriginalValue==='QA scratch '+a.name,a.name+': scratch value must match the dedicated QA fixture')
  }
 }
 if(device) {
  const d=(c.devices || []).find(x=>x.name===device)
  check(!!d,'device: unknown alias')
  if(d) {
   check(!!d.usernameEnv===!!d.passwordEnv,'device: username/password environment references must be supplied together')
   try {check(!placeholder(env[d.transportUrlEnv]) && !!origin(env[d.transportUrlEnv]),'device: supply '+d.transportUrlEnv)} catch {issues.push('device: invalid WebDriver URL')}
   for(const key of ['usernameEnv','passwordEnv'])if(d[key])check(!placeholder(env[d[key]]),'device: supply '+d[key])
   try {const caps=resolveEnv(d.capabilities,env);check(!JSON.stringify(caps).includes('REPLACE'),'device: replace capability placeholders');check(['safari','chrome'].includes(String(caps.browserName).toLowerCase()),'device: browserName must be Safari or Chrome');check(['mac','macos','ios','android'].includes(String(caps.platformName).toLowerCase()),'device: platformName must be mac/iOS/Android');check(caps.acceptInsecureCerts!==true,'device: certificate bypass is forbidden');check(!caps.pageLoadStrategy || caps.pageLoadStrategy==='normal','device: normal page-load strategy required');check(!Object.keys(caps).some(k=>/appPackage|appActivity|autoAcceptAlerts|autoGrantPermissions|^app$|:app$/i.test(k)),'device: browser sessions only; no app installation or permission changes')} catch {issues.push('device: unresolved or unsafe capability values')}
  }
 }
 return [...new Set(issues)]
}
export function resolveEnv(value,env=process.env) {
 if(Array.isArray(value))return value.map(v=>resolveEnv(v,env))
 if(value && typeof value==='object') {
  if(Object.keys(value).length===1 && '$env' in value) {invariant(!placeholder(env[value.$env]),'Missing capability environment variable');return env[value.$env]}
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolveEnv(v,env)]))
 }
 return value
}
export function marker(c) {return 'data-primo-launch-fixture="'+c.environmentId+'"'}
export function safeError(error) {if(error instanceof CheckError)return error.message;return error?.name==='AbortError' || error?.name==='TimeoutError' ? 'request-timeout' : 'request-or-assertion-failed'}
export async function request(c, value, {method='GET',token,body,headers={},beforeRequest}={}) {
 const u=publicUrl(value)
 const allowed=new Set([c.cmsOrigin,...c.publicPages.map(p=>new URL(p.url).origin)])
 invariant(allowed.has(u.origin),'Request origin is outside the configured staging scope')
 invariant(!token || u.origin===c.cmsOrigin,'Credentials may only be sent to the CMS origin')
 const allowedMutation=(method==='POST' && u.pathname==='/api/collections/users/auth-with-password') || (method==='PATCH' && /^\/api\/collections\/page_section_entries\/records\/[a-z0-9]{15}$/.test(u.pathname))
 invariant(method==='GET' || (u.origin===c.cmsOrigin && allowedMutation),'This tool cannot publish, deploy, create users, or send mail')
 if(beforeRequest)beforeRequest()
 const response=await fetch(u,{method,redirect:'error',signal:AbortSignal.timeout(c.requestTimeoutMs),headers:{...headers,...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)})
 const chunks=[];let bytes=0
 if(response.body)for await(const chunk of response.body) {
  bytes+=chunk.byteLength
  invariant(bytes<=4*1024*1024,'Response exceeds test evidence limit')
  chunks.push(chunk)
 }
 const text=Buffer.concat(chunks).toString('utf8')
 return {status:response.status,ok:response.ok,headers:response.headers,text,json:()=>JSON.parse(text)}
}
export function apiUrl(c,pathname) {const u=new URL(pathname,c.cmsOrigin);invariant(u.origin===c.cmsOrigin,'API URL escaped origin');return u.href}
export async function verifyTarget(c) {
 // No credential-bearing request is allowed before this public, unique fixture check.
 const probe=await request(c,apiUrl(c,c.cmsProbePath))
 invariant(probe.status===200 && probe.text.includes(marker(c)),'Published staging marker is missing; no authentication or writes attempted')
 const info=await request(c,apiUrl(c,'/api/primo/info'))
 invariant(info.ok,'CMS info request failed')
 const data=info.json()
 invariant(data.version===candidate.cms.version && data.dev_mode===false,'Expected RC.7 with production validation enabled')
 return {version:data.version,devMode:data.dev_mode,markerVerified:true,binaryProvenance:'operator must separately match the server artifact to candidate.json; HTTP version is not a binary hash'}
}
export async function login(c,a,env=process.env) {
 const r=await request(c,apiUrl(c,'/api/collections/users/auth-with-password'),{method:'POST',body:{identity:env[a.emailEnv],password:env[a.passwordEnv]}})
 invariant(r.ok,'Test-account authentication failed (including any rate limiting); no hidden retries')
 const data=r.json()
 invariant(data.record?.id===a.userId && data.record?.collectionName==='users' && !data.record.serverRole,'Use site-scoped QA members, not server-wide roles or superusers')
 invariant(typeof data.token==='string' && data.token.length>0,'No user token returned')
 return data.token
}
export async function record(c,collection,id,token,options={}) {
 const r=await request(c,apiUrl(c,'/api/collections/'+collection+'/records/'+id),{token,...options})
 invariant(r.ok,'Scoped record request failed')
 return r.json()
}
export const identity = e=>Object.fromEntries(['id','section','field','parent','locale','index'].map(k=>[k,e[k] ?? null]))
export function sameIdentity(a,b) {invariant(JSON.stringify(identity(a))===JSON.stringify(identity(b)),'Entry identity, ancestry or binding changed')}
export async function inspectActor(c,a,token) {
 const site=await record(c,'sites',a.siteId,token)
 invariant(site.name==='PRIMO QA '+a.name,'Site is not the named disposable QA fixture')
 const page=await record(c,'pages',a.pageId,token),section=await record(c,'page_sections',a.sectionId,token),field=await record(c,'site_symbol_fields',a.fieldId,token),entry=await record(c,'page_section_entries',a.entryId,token)
 invariant(page.site===a.siteId && section.page===a.pageId && section.symbol===field.symbol && entry.section===a.sectionId && entry.field===a.fieldId && field.type==='text' && field.key==='qa_scratch' && !field.parent && !entry.parent,'Scratch entry ownership chain is invalid')
 invariant(entry.value===a.expectedOriginalValue,'Scratch entry does not contain the exact disposable baseline; no write attempted')
 const list=await request(c,apiUrl(c,'/api/collections/sites/records?perPage=200'),{token})
 invariant(list.ok && list.json().items.length===1 && list.json().items[0].id===a.siteId && list.json().totalItems===1,'QA account must be restricted to exactly one site')
 const roles=await request(c,apiUrl(c,'/api/collections/site_role_assignments/records?perPage=200&filter='+encodeURIComponent('site="'+a.siteId+'" && user="'+a.userId+'"')),{token})
 invariant(roles.ok && roles.json().totalItems===1 && roles.json().items[0]?.role==='editor','Use one site-scoped content editor assignment for each QA actor')
 return entry
}
export async function privateReport(c,kind,data) {
 const dir=path.resolve(c.baseDirectory,c.outputDirectory)
 await fs.mkdir(dir,{recursive:true,mode:0o700})
 const file=path.join(dir,kind+'-'+randomUUID()+'.json')
 await fs.writeFile(file,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600})
 return file
}
export function p95(values) {return values.length ? [...values].sort((a,b)=>a-b)[Math.ceil(values.length*0.95)-1] : null}
export function printPlan(c,issues,kind) {
 console.log(JSON.stringify({kind,status:issues.length?'BLOCKED_MISSING_CONFIGURATION':'READY_NOT_RUN',networkRequests:0,missing:issues,environmentId:placeholder(c.environmentId)?'not-supplied':c.environmentId},null,2))
 return issues.length?2:0
}
