import {randomUUID} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {pathToFileURL} from 'node:url'
import {options,loadConfig,configIssues,printPlan,verifyTarget,login,inspectActor,record,request,apiUrl,privateReport,identity,sameIdentity,p95,marker,safeError,invariant} from './lib.mjs'

export async function soak(c,{profile='read',env=process.env,signal}={}) {
 const runId=randomUUID(),start=performance.now(),stats={requests:0,publicMs:[],saveMs:[],cycles:0,errors:0},actors=[]
 const result={kind:'bounded-soak',runId,profile,status:'FAIL',published:false,deployed:false,mailSent:false,cleanup:[],checks:[]}
 let stop=false,limited=false,failure=null
 console.log(JSON.stringify({event:'workload-run',runId}))
 const count=()=>{if(stats.requests>=c.soak.maxRequests){limited=true;throw Error('Request cap reached')}stats.requests++}
 const send=(url,options={})=>request(c,url,{...options,beforeRequest:count})
 const get=(collection,id,token)=>record(c,collection,id,token,{beforeRequest:count})
 const patch=(a,value)=>send(apiUrl(c,'/api/collections/page_section_entries/records/'+a.config.entryId),{method:'PATCH',token:a.token,body:{value}})
 try {
  result.target=await verifyTarget(c)
  if(profile==='edit') {
   // Validate every account and the entire controlled fixture before the first write.
   for(const config of c.actors) {
    if(actors.length)await delay(c.soak.loginIntervalMs ?? 1700,undefined,signal?{signal}:{})
    const token=await login(c,config,env),original=await inspectActor(c,config,token)
    actors.push({config,token,original,attempted:new Set()})
   }
   result.checks.push('all QA accounts have one site and exact synthetic scratch baselines')
  }
  const begin=performance.now(),end=begin+c.soak.durationSeconds*1000
  await Promise.all(Array.from({length:c.soak.workers},(_,index)=>(async()=>{
   const actor=actors[index]
   let iteration=0
   while(!stop && !signal?.aborted && performance.now()<end) {
    try {
     const before=performance.now(),page=c.publicPages[(index+iteration)%c.publicPages.length]
     const response=await send(page.url)
     invariant(response.status===200 && response.text.includes(marker(c)),'Public fixture response changed')
     stats.publicMs.push(performance.now()-before)
     if(actor) {
      const saveStart=performance.now(),value='PRIMO-QA:'+runId+':'+actor.config.name+':'+iteration
      const current=await get('page_section_entries',actor.config.entryId,actor.token)
      sameIdentity(current,actor.original)
      invariant(current.value===actor.original.value || actor.attempted.has(current.value),'Concurrent writer detected; do not overwrite')
      actor.attempted.add(value) // Also covers a write committed before a lost HTTP response.
      const saved=await patch(actor,value)
      invariant(saved.ok,'Scratch save failed')
      const persisted=await get('page_section_entries',actor.config.entryId,actor.token)
      sameIdentity(persisted,actor.original);invariant(persisted.value===value,'Scratch value was lost')
      stats.saveMs.push(performance.now()-saveStart)
      if(actors.length>1) {
       const other=actors[(index+1)%actors.length]
       const denied=await send(apiUrl(c,'/api/collections/page_section_entries/records/'+other.config.entryId),{token:actor.token})
       invariant([403,404].includes(denied.status),'Cross-tenant entry read was not denied')
      }
     }
     stats.cycles++;iteration++
     const wait=Math.min(c.soak.intervalMs,end-performance.now())
     if(wait>0 && !stop)await delay(wait,undefined,signal?{signal}:{})
    }catch(e){if(signal?.aborted)break;stats.errors++;failure=safeError(e);stop=true}
   }
  })()))
  result.measuredSeconds=(performance.now()-begin)/1000
 }catch(e){stats.errors++;failure=safeError(e)}
 finally {
  // Do not use the workload request cap or aborted signal during restoration.
  for(const a of actors) {
   const cleaned={actor:a.config.name,entryId:a.config.entryId,status:'NOT_WRITTEN'}
   try {
    const current=await record(c,'page_section_entries',a.config.entryId,a.token)
    sameIdentity(current,a.original)
    if(current.value!==a.original.value) {
     invariant(a.attempted.has(current.value),'Cleanup conflict: preserve the other writer')
     const response=await request(c,apiUrl(c,'/api/collections/page_section_entries/records/'+a.config.entryId),{method:'PATCH',token:a.token,body:{value:a.original.value}})
     invariant(response.ok,'Restoration request failed')
    }
    const restored=await record(c,'page_section_entries',a.config.entryId,a.token)
    sameIdentity(restored,a.original);invariant(restored.value===a.original.value,'Restoration did not persist')
    cleaned.status='BASELINE_RESTORED'
   }catch(e){cleaned.status='CONFLICT_OR_RESTORE_FAILED';failure=safeError(e);stats.errors++}
   result.cleanup.push(cleaned)
  }
 }
 result.totalSeconds=(performance.now()-start)/1000
 result.requests=stats.requests;result.completedCycles=stats.cycles;result.errors=stats.errors
 result.publicSamples=stats.publicMs.length;result.saveSamples=stats.saveMs.length
 result.p95PublicMs=p95(stats.publicMs);result.p95SaveRoundtripMs=p95(stats.saveMs)
 result.errorRate=stats.errors/Math.max(1,stats.cycles+stats.errors)
 result.criteria={confirmed:c.soak.criteriaConfirmed===true,minimumSeconds:c.soak.minimumGateSeconds,p95PublicMs:c.soak.p95PublicMs,p95SaveRoundtripMs:c.soak.p95SaveRoundtripMs,maxErrorRate:c.soak.maxErrorRate}
 const limitsMet=result.p95PublicMs!==null && result.p95PublicMs<=c.soak.p95PublicMs && (profile!=='edit' || (result.p95SaveRoundtripMs!==null && result.p95SaveRoundtripMs<=c.soak.p95SaveRoundtripMs)) && result.errorRate<=c.soak.maxErrorRate
 if(failure || limited || signal?.aborted || !stats.cycles) {result.failure=signal?.aborted?'interrupted':limited?'request-cap-reached':failure || 'no-completed-cycles'}
 else if(!limitsMet)result.failure='acceptance-threshold-exceeded'
 else result.status=profile==='edit' && actors.length>=10 && c.soak.criteriaConfirmed===true && result.measuredSeconds>=c.soak.minimumGateSeconds ? 'PASS_SOAK' : 'PASS_REHEARSAL_ONLY'
 result.note='No publication is performed. Public rendering is read-only; editor/publish capacity, hosting metrics and device handoffs need separate evidence. Never infer full launch readiness from this result.'
 return result
}
async function main() {
 const o=options();if(o.help){console.log('node soak.mjs --config staging.local.json [--profile read|edit] [--run]\nDefault: no network. Read profile never edits; edit profile writes only prevalidated synthetic scratch entries, then conditionally restores its own values. No publication.');return}
 const c=await loadConfig(o.config),issues=configIssues(c,{profile:o.profile})
 if(!o.run || issues.length){process.exitCode=printPlan(c,issues,'soak-'+o.profile);return}
 const controller=new AbortController(),stop=()=>controller.abort()
 process.once('SIGINT',stop);process.once('SIGTERM',stop)
 try {
  const result=await soak(c,{profile:o.profile,signal:controller.signal}),file=await privateReport(c,'soak',result)
  console.log(JSON.stringify({status:result.status,evidence:file}));process.exitCode=result.status.startsWith('PASS')?0:1
 }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop)}
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Configuration or local evidence failure; secrets are not printed.');process.exitCode=2})
