import fs from 'node:fs/promises'
import diagnostics from 'node:diagnostics_channel'
import {loadConfig,configIssues,invariant} from './lib.mjs'
import {soak} from './soak.mjs'
const c=await loadConfig('tests/staging/launch/qa-cloud-config.json')
invariant(c.cmsOrigin==='https://rc7-cms-disposable-rc7.up.railway.app'&&c.environmentId==='primo-rc7-qa-6fbf902e30857f0729ec4cf1','Only the existing disposable QA target is accepted')
const scoped=JSON.parse(process.env.PRIMO_QA_SCOPED_USERS||'{}'),env={...process.env,...scoped}
for(const a of c.actors){invariant(scoped[a.emailEnv]?.endsWith('@primo-qa.invalid')&&scoped[a.passwordEnv]?.length>=24,'Fresh scoped QA credentials required');for(const value of [scoped[a.emailEnv],scoped[a.passwordEnv]])console.log('::add-mask::'+value.replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A'))}
invariant(configIssues(c,{profile:'edit',env}).length===0,'Invalid bounded QA configuration')
await fs.mkdir('qa-soak-results',{recursive:true})
const start=new Date().toISOString();await fs.writeFile('qa-soak-results/full-start.json',JSON.stringify({mode:'full',start,durationSeconds:c.soak.durationSeconds,workers:c.soak.workers,criteria:c.soak,client:'GitHub Actions ubuntu-24.04 Node22.17.0'}))
for(const event of ['undici:client:connectError','undici:request:error'])diagnostics.channel(event).subscribe(message=>fs.appendFile('qa-soak-results/transport-errors.jsonl',JSON.stringify({event,utc:new Date().toISOString(),code:message.error?.code||message.error?.cause?.code||null,path:message.request?.path?.split('?')[0]||null})+'\n').catch(()=>{}))
const controller=new AbortController();for(const event of ['SIGINT','SIGTERM'])process.once(event,()=>controller.abort())
const result=await soak(c,{profile:'edit',env,signal:controller.signal});result.reportedFinishedUtc=new Date().toISOString();await fs.copyFile('tests/staging/launch/request-failures.jsonl','qa-soak-results/request-failures.jsonl').catch(()=>{});result.client={testedProductSourceCommit:'10d6d648f228efeae406965f4729d16a0aeacd6f',clientSourceCommit:process.env.GITHUB_SHA,ciRun:process.env.GITHUB_RUN_ID,location:'GitHub Actions ubuntu-24.04',node:process.version,undici:process.versions.undici,macNetworkRequired:false,requestRetries:0}
await fs.writeFile('qa-soak-results/full-result.json',JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({status:result.status,runId:result.runId,measuredSeconds:result.measuredSeconds,requests:result.requests,errors:result.errors,p95PublicMs:result.p95PublicMs,p95SaveRoundtripMs:result.p95SaveRoundtripMs}))
process.exitCode=result.status==='PASS_SOAK'?0:1
