import {options,loadConfig,configIssues,printPlan,verifyTarget,request,privateReport,marker,safeError,invariant} from './lib.mjs'
export async function preflight(c) {
 const result={kind:'staging-readiness',status:'FAIL',checks:[],mailSent:false,deployed:false,published:false}
 try {
  result.target=await verifyTarget(c)
  result.checks.push('unique published fixture; RC.7; production mode')
  for(let i=0;i<c.publicPages.length;i++) {
   const page=c.publicPages[i],r=await request(c,page.url)
   invariant(r.status===200 && r.text.includes(marker(c)),'Public fixture missing')
   invariant(r.headers.get('cache-control')?.includes('no-cache') && r.headers.get('x-content-type-options')==='nosniff' && r.headers.get('referrer-policy')==='strict-origin-when-cross-origin','Public cache/security header mismatch')
   const modified=r.headers.get('last-modified');invariant(!!modified,'Last-Modified missing')
   invariant((await request(c,page.url,{headers:{'If-Modified-Since':modified}})).status===304,'Conditional revalidation failed')
   result.checks.push('page '+i+': marker, configured-origin transport, security/cache headers, 304')
  }
  const preview=await request(c,new URL(c.cmsProbePath,c.cmsOrigin).href)
  invariant(preview.status===200 && preview.text.includes(marker(c)) && preview.headers.get('cache-control')?.includes('no-store'),'Preview cache policy failed')
  result.checks.push('CMS marked _site preview: no-store')
  result.status='PASS_READ_ONLY_PREFLIGHT'
  result.remaining=['server artifact hash attestation','SMTP AUTH/TLS and actual inbox delivery','DNS/ACME lifecycle and publication-driven CDN refresh','device editor/publication checklist','representative migration/restore','capacity acceptance']
 } catch(e) {result.failure=safeError(e)}
 return result
}
async function main() {
 const o=options();if(o.help){console.log('node preflight.mjs --config staging.local.json [--run]\nDefault: configuration only. --run: read-only external checks; no mail/publication/deployment.');return}
 const c=await loadConfig(o.config),issues=configIssues(c)
 if(!o.run || issues.length){process.exitCode=printPlan(c,issues,'preflight');return}
 const result=await preflight(c),file=await privateReport(c,'preflight',result)
 console.log(JSON.stringify({status:result.status,evidence:file}));process.exitCode=result.status.startsWith('PASS')?0:1
}
if(process.argv[1] && import.meta.url===(await import('node:url')).pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Configuration or local evidence failure; inspect inputs without printing secrets.');process.exitCode=2})
