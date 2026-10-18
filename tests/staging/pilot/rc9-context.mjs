import assert from 'node:assert/strict'
const ORIGIN='https://rc8-pilot-cms-pilot-rc8.up.railway.app'
const COMMIT='15085e33013584ba47c581052997e93e7131a37d'
const SHA='225ee7e19272d33604ec26eac239dfa11ae2072b1b85500dc59847a66866d303'
export function validateActor(actor){
 assert.equal(actor.origin,ORIGIN);assert.equal(actor.sourceCommit,COMMIT);assert.equal(actor.nativeSha256,SHA)
 assert.equal(actor.environmentId,'e9f6f82b-aac0-4612-93ae-07b4a896635e')
 for(const key of ['siteId','sectionId','headingId','userId'])assert.match(actor[key],/^[a-z0-9]{15}$/)
 assert.equal(actor.email,'client-rc9-canary@primo-pilot.invalid');assert.ok(typeof actor.password==='string'&&actor.password.length>=24)
 return actor
}
export async function hostedContext(){
 const actor=validateActor(JSON.parse(process.env.PRIMO_RC9_CANARY_EDITOR||'{}'))
 const credentials=new Set([actor.email,actor.password])
 const redact=value=>{let text=String(value);for(const v of credentials)text=text.replaceAll(v,'[temporary QA credential]');return text.replace(/eyJ[A-Za-z0-9_.-]{30,}/g,'[TOKEN]')}
 let before
 const api=async(route,{method='GET',token,body}={})=>{
  const u=new URL(route,ORIGIN);assert.equal(u.origin,ORIGIN);assert.ok(!u.hash&&!u.username&&!u.password)
  assert.ok(method==='GET'||method==='POST'&&u.pathname==='/api/collections/users/auth-with-password'||method==='PATCH'&&/^\/api\/collections\/page_section_entries\/records\/[a-z0-9]{15}$/.test(u.pathname),'No publication, account creation or other writes allowed')
  if(method==='PATCH')assert.ok(before?.some(e=>e.id===u.pathname.split('/').at(-1)),'Only inspected synthetic entries can be changed')
  const r=await fetch(u,{method,redirect:'error',signal:AbortSignal.timeout(60000),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)})
  assert.ok(r.ok,method+' '+u.pathname+' HTTP '+r.status);return r.status===204?null:r.json()
 }
 const info=await api('/api/primo/info');assert.equal(info.version,'v3.3.2-rc.9');assert.equal(info.dev_mode,false);assert.equal(info.smtp_enabled,false);assert.equal(info.telemetry_enabled,false)
 const auth=await api('/api/collections/users/auth-with-password',{method:'POST',body:{identity:actor.email,password:actor.password}});credentials.add(auth.token)
 assert.equal(auth.record.id,actor.userId);assert.equal(auth.record.serverRole,'')
 const list=async name=>{const r=await api('/api/collections/'+name+'/records?perPage=500&sort=id',{token:auth.token});assert.equal(r.totalItems,r.items.length);return r.items}
 const sites=await list('sites');assert.equal(sites.length,1);assert.equal(sites[0].id,actor.siteId);assert.equal(sites[0].name,'Disposable RC.9 access check');assert.equal(sites[0].host,'access-check.primo-pilot.invalid')
 const roles=await list('site_role_assignments');assert.equal(roles.length,1);assert.equal(roles[0].user,actor.userId);assert.equal(roles[0].site,actor.siteId);assert.equal(roles[0].role,'editor')
 const fields=await list('site_symbol_fields'),sections=await list('page_sections');assert.equal(sections.length,5);const section=sections.find(e=>e.id===actor.sectionId);assert.ok(section)
 const entries=()=>list('page_section_entries');before=await entries();const heading=before.find(e=>e.id===actor.headingId);assert.equal(heading.section,section.id);assert.equal(fields.find(f=>f.id===heading.field).key,'heading')
 const verifyContent=async(tag)=>{const after=await entries();assert.deepEqual(after.map(e=>e.id),before.map(e=>e.id));for(const old of before){const n=after.find(e=>e.id===old.id);for(const key of ['field','section','parent','locale'])assert.deepEqual(n[key],old[key]);assert.deepEqual(n.value,tag&&old.id===heading.id?tag:old.value)}return after}
 return {origin:ORIGIN,provenance:{candidate:info.version,sourceCommit:COMMIT,nativeSha256:SHA,origin:ORIGIN},actors:{editor:{email:actor.email,password:actor.password,auth}},api,redact,entries,before,fields,section,heading,verifyContent,list,site:sites[0]}
}
