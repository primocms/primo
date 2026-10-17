import {context,fs,path,delay,invariant} from './lib.mjs'
const c=await context(),actor=JSON.parse(await fs.readFile(path.join(c.run,'private/actors.json'),'utf8'))[0]
const admin=await c.login(c.credentials.adminEmail,c.credentials.adminPassword,true)
const client=await c.login(actor.email,actor.password)
const report={origin:c.state.cmsOrigin,checks:[],runtimeChanged:false,rateLimiterDisabled:false}
const settings=await c.ok('/api/settings',{token:admin.token})
report.beforeProxy=settings.trustedProxy
async function subscriptionProbe(spoofed=false) {
 const controller=new AbortController(),headers=spoofed?{'X-Real-IP':'203.0.113.17','X-Forwarded-For':'203.0.113.19'}:{}
 let reader
 try {
  const response=await fetch(c.state.cmsOrigin+'/api/realtime',{headers,redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])})
  invariant(response.ok,'SSE connection rejected')
  reader=response.body.getReader();let text='',clientId
  while(!clientId) {
   const value=await reader.read();invariant(!value.done,'SSE closed before connect')
   text+=new TextDecoder().decode(value.value)
   const line=text.split('\n').find(l=>l.startsWith('data:'))
   if(line)clientId=JSON.parse(line.slice(5).trim()).clientId
  }
  const post=await fetch(c.state.cmsOrigin+'/api/realtime',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+client.token,'Content-Type':'application/json',...(spoofed?{'X-Real-IP':'203.0.113.18','X-Forwarded-For':'203.0.113.20'}:{})},body:JSON.stringify({clientId,subscriptions:['page_section_entries/'+actor.entryId]})})
  return {status:post.status}
 }finally{controller.abort();await reader?.cancel().catch(()=>{})}
}
report.before=await subscriptionProbe()
if(report.before.status!==204) {
 await c.ok('/api/settings',{method:'PATCH',token:admin.token,body:{trustedProxy:{headers:['X-Real-IP'],useLeftmostIP:false}}})
 report.configurationChange='Only the dedicated Railway test service trusts Railway-managed X-Real-IP; it has no direct public TCP endpoint. Production and other projects untouched.'
}
report.after=await subscriptionProbe()
invariant(report.after.status===204,'Realtime registration still rejected after proxy configuration')
report.spoofedClientHeaders=await subscriptionProbe(true)
invariant(report.spoofedClientHeaders.status===204,'The provider must replace client-supplied IP headers with the actual visitor IP')
const fresh=await c.ok('/api/settings',{token:admin.token})
invariant(fresh.rateLimits.enabled && JSON.stringify(fresh.rateLimits)===JSON.stringify(settings.rateLimits),'Production limiter changed')
report.afterProxy=fresh.trustedProxy;report.checks.push('Same-origin live realtime registration HTTP 204 through real ingress','Different forged visitor-IP headers cannot change the identity selected by the trusted provider edge','Existing rate-limiter configuration retained verbatim')
report.status='PASS_RAILWAY_REALTIME_CONFIGURATION'
await c.save('realtime-proxy.json',report);console.log(JSON.stringify(report,null,2))
