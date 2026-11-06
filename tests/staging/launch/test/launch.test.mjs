import {test} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {createHash} from 'node:crypto'
import {spawn} from 'node:child_process'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {compile} from 'svelte/compiler'
import {candidate,configIssues,request,verifyTarget,privateReport,resolveEnv,identity} from '../lib.mjs'
import {preflight} from '../preflight.mjs'
import {soak} from '../soak.mjs'
import {deviceProbe} from '../device.mjs'
import {fixtureIssues,inventory} from '../fixture.mjs'
import {attest} from '../attest-binary.mjs'

const id=(prefix,i)=>prefix+String(i).padStart(14,'0')
async function fixture(t,{count=10}={}) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'primo-launch-tool-test-'))
 const env={},actors=Array.from({length:count},(_,n)=>{
  const i=n+1,name='agency-'+String(i).padStart(2,'0');env['QA_EMAIL_'+i]='actor'+i+'@qa.test';env['QA_PASSWORD_'+i]='Test-only-password-'+i
  return {name,emailEnv:'QA_EMAIL_'+i,passwordEnv:'QA_PASSWORD_'+i,userId:id('u',i),siteId:id('s',i),pageId:id('p',i),sectionId:id('c',i),fieldId:id('f',i),entryId:id('e',i),expectedOriginalValue:'QA scratch '+name}
 })
 const state={requests:[],entries:new Map(actors.map(a=>[a.entryId,{id:a.entryId,section:a.sectionId,field:a.fieldId,parent:'',locale:'en',index:0,value:a.expectedOriginalValue}])),badMarker:false,badPreviewCache:false,devMode:false,crossReadAllowed:false,onPatch:null,failPatchOnce:false,deviceBadHeadings:false,deviceBadPlatform:false,scratchKey:'qa_scratch',siteRole:'editor',sessionOpened:0,sessionClosed:0,counter:0,pageUrl:null}
 let base
 const server=http.createServer(async(req,res)=>{
  try {
   const url=new URL(req.url,base);let raw='';for await(const chunk of req)raw+=chunk
   const body=raw?JSON.parse(raw):null;state.requests.push({at:performance.now(),method:req.method,path:url.pathname,body,authorization:req.headers.authorization})
   const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value))}
   if(url.pathname.startsWith('/wd/')) {
    if(req.method==='POST' && url.pathname==='/wd/session'){state.sessionOpened++;return json(200,{value:{sessionId:'test-session',capabilities:{browserName:'safari',browserVersion:'mock-only',platformName:state.deviceBadPlatform?'Android':'mac'}}})}
    if(req.method==='DELETE'){state.sessionClosed++;return json(200,{value:null})}
    if(url.pathname.endsWith('/url')){if(body)state.pageUrl=body.url;return json(200,{value:body?null:state.pageUrl})}
    if(url.pathname.endsWith('/refresh'))state.counter=0
    if(url.pathname.endsWith('/element'))return json(200,{value:{'element-6066-11e4-a52e-4f735466cecf':'counter'}})
    if(url.pathname.endsWith('/click'))state.counter++
    if(url.pathname.endsWith('/execute/sync')) {
     if(body.script.includes('window.__primoQAHeadingNodes'))return json(200,{value:true})
     return json(200,{value:{markers:Array(5).fill(c.environmentId),headings:state.deviceBadHeadings?['wrong']:c.publicPages[0].headings,visible:true,counter:'Count '+state.counter,width:390,scrollWidth:390,ready:'complete'}})
    }
    return json(200,{value:null})
   }
   if(url.pathname==='/oversized'){res.writeHead(200);return res.end('x'.repeat(4*1024*1024+1))}
   if(url.pathname==='/redirect'){res.writeHead(302,{Location:base+'/escaped'});return res.end()}
   if(url.pathname==='/escaped')return json(200,{stolen:true})
   if(url.pathname==='/api/primo/info')return json(200,{version:candidate.cms.version,dev_mode:state.devMode})
   if(url.pathname==='/') {
    const preview=url.searchParams.has('_site') && !state.badPreviewCache,modified='Fri, 16 Oct 2026 20:00:00 GMT'
    if(req.headers['if-modified-since']===modified){res.writeHead(304);return res.end()}
    res.writeHead(200,{'Content-Type':'text/html','Cache-Control':preview?'no-store':'no-cache','Last-Modified':modified,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'})
    return res.end('<section data-primo-launch-fixture="'+(state.badMarker?'wrong':c.environmentId)+'">QA</section>')
   }
   if(url.pathname==='/api/collections/users/auth-with-password') {
    const actor=actors.find(a=>env[a.emailEnv]===body.identity && env[a.passwordEnv]===body.password)
    return actor?json(200,{token:'token-'+actor.name,record:{id:actor.userId,collectionName:'users',serverRole:''}}):json(400,{message:'denied'})
   }
   const actor=actors.find(a=>req.headers.authorization==='Bearer token-'+a.name)
   if(!actor)return json(403,{message:'denied'})
   if(url.pathname==='/api/collections/site_role_assignments/records')return json(200,{items:[{site:actor.siteId,user:actor.userId,role:state.siteRole}],totalItems:1})
   if(url.pathname==='/api/collections/sites/records')return json(200,{items:[{id:actor.siteId}],totalItems:1})
   const match=url.pathname.match(/^\/api\/collections\/(\w+)\/records\/([a-z0-9]{15})$/)
   if(!match)return json(404,{})
   const [,collection,recordId]=match
   if(collection==='sites' && recordId===actor.siteId)return json(200,{id:recordId,name:'PRIMO QA '+actor.name})
   if(collection==='pages' && recordId===actor.pageId)return json(200,{id:recordId,site:actor.siteId})
   if(collection==='page_sections' && recordId===actor.sectionId)return json(200,{id:recordId,page:actor.pageId,symbol:id('b',actors.indexOf(actor)+1)})
   if(collection==='site_symbol_fields' && recordId===actor.fieldId)return json(200,{id:recordId,symbol:id('b',actors.indexOf(actor)+1),type:'text',key:state.scratchKey,parent:''})
   if(collection==='page_section_entries' && (recordId===actor.entryId || state.crossReadAllowed)) {
    const entry=state.entries.get(recordId)
    if(!entry)return json(404,{})
    if(req.method==='PATCH') {
     entry.value=body.value
     if(state.onPatch)state.onPatch(entry,body)
     if(state.failPatchOnce && body.value.startsWith('PRIMO-QA:')){state.failPatchOnce=false;return json(500,{message:'injected lost success response'})}
    }
    return json(200,entry)
   }
   return json(404,{})
  }catch{res.writeHead(500);res.end('{}')}
 })
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port
 const c={baseDirectory:root,outputDirectory:'.runs',environmentId:'primo-rc7-disposable-test',disposable:true,cmsOrigin:base,cmsProbePath:'/?_site='+id('s',1),publicPages:[{url:base+'/',headings:Array.from({length:5},(_,i)=>'QA section '+i)}],requestTimeoutMs:2000,soak:{durationSeconds:1,minimumGateSeconds:3600,workers:count,loginIntervalMs:0,intervalMs:1000,maxRequests:1000,criteriaConfirmed:true,exclusiveScratchRecords:true,p95PublicMs:10000,p95SaveRoundtripMs:10000,maxErrorRate:0},actors,devices:[{name:'mock-safari',transportUrlEnv:'QA_WD_URL',physical:false,capabilities:{browserName:'safari',platformName:'mac'}}]}
 env.QA_WD_URL=base+'/wd'
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true})})
 return {c,env,state,root,actors}
}
function baseline(f) {for(const a of f.actors)assert.equal(f.state.entries.get(a.entryId).value,a.expectedOriginalValue)}

test('templates block execution and name missing inputs without exposing secrets',async()=>{
 const c=JSON.parse(await fs.readFile(new URL('../staging.example.json',import.meta.url),'utf8'))
 assert.ok(configIssues(c,{profile:'edit',device:'iphone-safari',env:{PRIMO_QA_PASSWORD_01:'never-print-this'}}).length>10)
 assert.ok(!JSON.stringify(configIssues(c,{profile:'edit',env:{}})).includes('never-print-this'))
 assert.throws(()=>resolveEnv({$env:'MISSING'},{}))
})
test('configuration rejects non-TLS remote origins and unsafe browser capabilities',async t=>{
 const f=await fixture(t,{count:1});f.c.cmsOrigin='http://remote.qa.test';assert.ok(configIssues(f.c).some(x=>x.includes('cmsOrigin')))
 f.c.cmsOrigin=new URL(f.env.QA_WD_URL).origin;f.c.devices[0].capabilities.acceptInsecureCerts=true
 assert.ok(configIssues(f.c,{device:'mock-safari',env:f.env}).some(x=>x.includes('certificate bypass')))
 f.c.devices[0].capabilities['appium:app']='installer';assert.ok(configIssues(f.c,{device:'mock-safari',env:f.env}).some(x=>x.includes('browser sessions only')))
})
test('default CLI plan with valid inputs makes zero network requests',async t=>{
 const f=await fixture(t,{count:1}),config=path.join(f.root,'staging.local.json');await fs.writeFile(config,JSON.stringify(f.c))
 const result=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[new URL('../preflight.mjs',import.meta.url).pathname,'--config',config],{env:{...process.env,...f.env}});let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b);p.on('error',reject);p.on('close',code=>resolve({code,output}))})
 assert.equal(result.code,0);assert.match(result.output,/READY_NOT_RUN/);assert.equal(f.state.requests.length,0)
})
test('request scope blocks credential forwarding and all publication/deployment routes',async t=>{
 const f=await fixture(t,{count:1})
 for(const method of ['POST','PATCH','DELETE'])await assert.rejects(request(f.c,f.c.cmsOrigin+'/api/primo/generate',{method,token:'secret'}))
 await assert.rejects(request(f.c,'https://other.qa.test/',{token:'secret'}));assert.equal(f.state.requests.length,0)
 await assert.rejects(request(f.c,f.c.cmsOrigin+'/redirect',{token:'secret'}));assert.equal(f.state.requests.some(r=>r.path==='/escaped'),false)
})
test('missing public marker or development mode prevents authentication and edits',async t=>{
 const f=await fixture(t,{count:1});f.state.badMarker=true
 assert.equal((await soak(f.c,{profile:'edit',env:f.env})).status,'FAIL');assert.equal(f.state.requests.some(r=>r.method==='POST' || r.method==='PATCH'),false)
 f.state.badMarker=false;f.state.devMode=true;await assert.rejects(verifyTarget(f.c));baseline(f)
})
test('read-only preflight checks actual headers and conditional requests without mutations',async t=>{
 const f=await fixture(t,{count:1});const r=await preflight(f.c);assert.equal(r.status,'PASS_READ_ONLY_PREFLIGHT');assert.ok(r.remaining.includes('SMTP AUTH/TLS and actual inbox delivery'));assert.ok(f.state.requests.every(r=>r.method==='GET'))
})
test('ten mock agencies save, retain IDs/bindings, deny cross-site reads and restore every scratch value',async t=>{
 const f=await fixture(t);assert.deepEqual(configIssues(f.c,{profile:'edit',env:f.env}),[])
 const before=[...f.state.entries.values()].map(identity),r=await soak(f.c,{profile:'edit',env:f.env})
 assert.equal(r.status,'PASS_REHEARSAL_ONLY');assert.ok(r.saveSamples>=10);assert.equal(r.errors,0);baseline(f);assert.deepEqual([...f.state.entries.values()].map(identity),before)
 assert.ok(r.cleanup.every(x=>x.status==='BASELINE_RESTORED'));assert.ok(!JSON.stringify(r).includes('token-'));assert.ok(!JSON.stringify(r).includes('Test-only-password'))
})
test('read-only soak performs no logins or writes and never clears an edit-capacity gate',async t=>{
 const f=await fixture(t,{count:1}),r=await soak(f.c,{profile:'read',env:f.env});assert.equal(r.status,'PASS_REHEARSAL_ONLY');assert.ok(f.state.requests.every(r=>r.method==='GET'));baseline(f)
})
test('a committed save with a failed response is recovered without losing its original value',async t=>{
 const f=await fixture(t,{count:1});f.state.failPatchOnce=true;const r=await soak(f.c,{profile:'edit',env:f.env});assert.equal(r.status,'FAIL');assert.equal(r.cleanup[0].status,'BASELINE_RESTORED');baseline(f)
})
test('detected concurrent changes are preserved, never blindly overwritten by cleanup',async t=>{
 const f=await fixture(t,{count:1});f.state.onPatch=(entry,body)=>{if(body.value.startsWith('PRIMO-QA:'))entry.value='Other QA operator edit'}
 const r=await soak(f.c,{profile:'edit',env:f.env});assert.equal(r.status,'FAIL');assert.equal(r.cleanup[0].status,'CONFLICT_OR_RESTORE_FAILED');assert.equal(f.state.entries.get(f.actors[0].entryId).value,'Other QA operator edit');assert.equal(f.state.requests.filter(r=>r.method==='PATCH').length,1)
})
test('cross-tenant exposure fails the workload and restores its own writes',async t=>{
 const f=await fixture(t,{count:2});f.state.crossReadAllowed=true;const r=await soak(f.c,{profile:'edit',env:f.env});assert.equal(r.status,'FAIL');assert.match(r.failure,/Cross-tenant/);baseline(f)
})
test('interruptions and request caps stop workload while restoration remains available',async t=>{
 const f=await fixture(t,{count:1}),controller=new AbortController();f.state.onPatch=()=>controller.abort()
 const r=await soak(f.c,{profile:'edit',env:f.env,signal:controller.signal});assert.equal(r.status,'FAIL');assert.equal(r.failure,'interrupted');baseline(f)
 f.state.onPatch=null;f.c.soak.maxRequests=1;const capped=await soak(f.c,{profile:'edit',env:f.env});assert.equal(capped.failure,'request-cap-reached');assert.ok(capped.requests<=1);baseline(f)
})
test('wrong scratch values block the entire edit workload before any mutation',async t=>{
 const f=await fixture(t,{count:2});f.state.entries.get(f.actors[1].entryId).value='Do not touch'
 const r=await soak(f.c,{profile:'edit',env:f.env});assert.equal(r.status,'FAIL');assert.equal(f.state.requests.some(r=>r.method==='PATCH'),false)
})
test('mock W3C probe checks rendering, interaction and reload, then deletes its session',async t=>{
 const f=await fixture(t,{count:1});const r=await deviceProbe(f.c,f.c.devices[0],{env:f.env});assert.equal(r.status,'PASS_PUBLIC_SMOKE_ONLY');assert.equal(r.pages[0].counter,'Count 1');assert.equal(r.physicalDeviceAttested,false);assert.equal(r.editorGate,'NOT_RUN');assert.equal(f.state.sessionOpened,1);assert.equal(f.state.sessionClosed,1)
 assert.ok(!JSON.stringify(r).includes('token-'))
})
test('device assertion failure still cleans its session and never claims real mobile coverage',async t=>{
 const f=await fixture(t,{count:1});f.state.deviceBadPlatform=true;const r=await deviceProbe(f.c,f.c.devices[0],{env:f.env});assert.equal(r.status,'FAIL');assert.equal(r.physicalDeviceAttested,false);assert.equal(f.state.sessionClosed,1)
})
test('private evidence is exclusively created with restrictive permissions',async t=>{
 const f=await fixture(t,{count:1}),file=await privateReport(f.c,'test',{status:'mock'});assert.equal((await fs.stat(file)).mode & 0o777,0o600);assert.equal(JSON.parse(await fs.readFile(file,'utf8')).status,'mock')
})
test('fixture inventory is read-only, verifies owner checksum, and rejects live WAL/symlinks',async t=>{
 const f=await fixture(t,{count:1}),root=path.join(f.root,'backup');await fs.mkdir(path.join(root,'storage'),{recursive:true});await fs.writeFile(path.join(root,'data.db'),'sanitized fake fixture');await fs.writeFile(path.join(root,'storage/image.txt'),'fake asset')
 const hash=createHash('sha256');for(const name of ['data.db','storage/image.txt'])hash.update(name+'\0'+createHash('sha256').update(await fs.readFile(path.join(root,name))).digest('hex')+'\n')
 const c={baseDirectory:f.root,outputDirectory:'.runs',sourcePrimoVersion:'v3.3.1',sourcePocketBaseVersion:'owner-recorded-version',backupPath:root,sha256:hash.digest('hex'),ownerVerifiedSanitized:true,ownerVerifiedConsistentOfflineBackup:true,expected:{sites:1,pages:5,uploads:1}}
 assert.deepEqual(fixtureIssues(c),[]);const r=await inventory(c);assert.equal(r.status,'PASS_INVENTORY_ONLY');assert.equal(r.files.length,2);assert.equal(await fs.readFile(path.join(root,'data.db'),'utf8'),'sanitized fake fixture')
 await fs.writeFile(path.join(root,'data.db-wal'),'live');await assert.rejects(inventory(c),/WAL/);await fs.rm(path.join(root,'data.db-wal'));await fs.symlink(path.join(root,'data.db'),path.join(root,'linked'));await assert.rejects(inventory(c),/symlink/)
})
test('candidate pins match the frozen QA manifest and unknown binary bytes are rejected',async t=>{
 const original=JSON.parse(await fs.readFile(new URL('../../rc7-packages.json',import.meta.url),'utf8'));assert.equal(candidate.cms.sha256,original.cms.sha256);assert.equal(candidate.cli.sha256,original.cli.sha256);assert.equal(candidate.mcp.sha256,original.mcp.sha256)
 const f=await fixture(t,{count:1}),p=path.join(f.root,'not-primo');await fs.writeFile(p,'wrong');await assert.rejects(attest(p,'linux_amd64'),/does not match/)
})
test('prepared device fixture compiles with zero Svelte warnings',async()=>{
 const code=await fs.readFile(new URL('../fixtures/qa-block.svelte',import.meta.url),'utf8');assert.deepEqual(compile(code,{filename:'qa-block.svelte',generate:'client'}).warnings,[])
})

async function cli(script,args,env) {
 return new Promise((resolve,reject)=>{
  const p=spawn(process.execPath,[new URL('../'+script,import.meta.url).pathname,...args],{env:{...process.env,...env}})
  let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b)
  p.on('error',reject);p.on('close',code=>resolve({code,output}))
 })
}
test('all staging CLI entry points rehearse against loopback and write private evidence',async t=>{
 const f=await fixture(t,{count:1}),config=path.join(f.root,'staging.local.json')
 await fs.writeFile(config,JSON.stringify(f.c))
 for(const [script,args,status] of [
  ['preflight.mjs',[],'PASS_READ_ONLY_PREFLIGHT'],
  ['device.mjs',['--device','mock-safari'],'PASS_PUBLIC_SMOKE_ONLY'],
  ['soak.mjs',['--profile','edit'],'PASS_REHEARSAL_ONLY']
 ]) {
  const r=await cli(script,['--config',config,...args,'--run'],f.env)
  assert.equal(r.code,0,r.output);const report=JSON.parse(r.output);assert.equal(report.status,status)
  assert.equal((await fs.stat(report.evidence)).mode & 0o777,0o600)
  assert.ok(!r.output.includes('Test-only-password'));assert.ok(!r.output.includes('token-'))
 }
 baseline(f);assert.equal(f.state.sessionClosed,1)
 assert.ok(f.state.requests.every(r=>!r.path.includes('generate') && !r.path.includes('invite')))
})
test('a design field or developer membership cannot be used for an edit soak',async t=>{
 const f=await fixture(t,{count:1});f.state.scratchKey='heading'
 assert.equal((await soak(f.c,{profile:'edit',env:f.env})).status,'FAIL')
 f.state.scratchKey='qa_scratch';f.state.siteRole='developer'
 assert.equal((await soak(f.c,{profile:'edit',env:f.env})).status,'FAIL')
 assert.equal(f.state.requests.some(r=>r.method==='PATCH'),false);baseline(f)
})
test('streamed oversized responses are bounded before entering test evidence',async t=>{
 const f=await fixture(t,{count:1});await assert.rejects(request(f.c,f.c.cmsOrigin+'/oversized'),/exceeds test evidence limit/)
})

test('complete fixture files pass the pinned packaged MCP block and page validators',async t=>{
 const f=await fixture(t,{count:1}),site=path.join(f.root,'site')
 const require=createRequire(import.meta.url),entry=pathToFileURL(require.resolve('primo-mcp'))
 const {validateBlockFromDisk}=await import(new URL('./validators/block.js',entry))
 const {validatePageFromDisk}=await import(new URL('./tools/validate_page.js',entry))
 assert.equal(JSON.parse(await fs.readFile(new URL('../package.json',entry),'utf8')).version,'0.1.11')
 for(const [source,destination] of [
  ['qa-block.svelte','blocks/qa-probe/component.svelte'],
  ['qa-fields.yaml','blocks/qa-probe/fields.yaml'],
  ['qa-content.example.yaml','blocks/qa-probe/content.yaml'],
  ['qa-page.example.yaml','pages/index.yaml']
 ]) {
  const file=path.join(site,destination);await fs.mkdir(path.dirname(file),{recursive:true})
  const contents=(await fs.readFile(new URL('../fixtures/'+source,import.meta.url),'utf8')).replaceAll('REPLACE_WITH_UNIQUE_DISPOSABLE_ENVIRONMENT',f.c.environmentId)
  await fs.writeFile(file,contents)
 }
 await fs.writeFile(path.join(site,'blocks/qa-probe/config.yaml'),'name: QA probe\n')
 await fs.mkdir(path.join(site,'page-types/default'),{recursive:true})
 await fs.writeFile(path.join(site,'page-types/default/config.yaml'),'name: Default\nallowed_blocks: [qa-probe]\n')
 const block=await validateBlockFromDisk({site_path:site,name:'qa-probe'})
 assert.equal(block.ok,true,JSON.stringify(block))
 assert.ok(block.errors.every(e=>e.severity==='warning' && /"environment"|"qa_scratch"/.test(e.message)),JSON.stringify(block))
 const page=await validatePageFromDisk({site_path:site,page_path:'pages/index.yaml'})
 assert.equal(page.ok,true,JSON.stringify(page));assert.deepEqual(page.errors,[])
})

test('edit setup paces authentication and still validates every actor before the first write',async t=>{
 const f=await fixture(t,{count:2});f.c.soak.loginIntervalMs=40
 const r=await soak(f.c,{profile:'edit',env:f.env});assert.equal(r.status,'PASS_REHEARSAL_ONLY')
 const auth=f.state.requests.filter(r=>r.path.endsWith('/auth-with-password'))
 assert.equal(auth.length,2);assert.ok(auth[1].at-auth[0].at>=35)
 const firstPatch=f.state.requests.findIndex(r=>r.method==='PATCH')
 assert.ok(firstPatch>f.state.requests.indexOf(auth[1]));baseline(f)
 f.c.cmsOrigin='https://cms.disposable-rc7.invalid';f.c.soak.loginIntervalMs=0
 assert.ok(configIssues(f.c,{profile:'edit',env:f.env}).some(x=>x.includes('auth throttling')))
})

test('preflight uses the actual _site preview contract and rejects cacheable previews',async t=>{
 const f=await fixture(t,{count:1});assert.equal((await preflight(f.c)).status,'PASS_READ_ONLY_PREFLIGHT')
 assert.ok(f.state.requests.some(r=>r.path==='/'));f.state.badPreviewCache=true
 const r=await preflight(f.c);assert.equal(r.status,'FAIL');assert.match(r.failure,/Preview cache policy/)
 f.c.cmsProbePath='/';assert.ok(configIssues(f.c).some(x=>x.includes('_site preview')))
})

test('owned-backup inventory refuses unrelated inputs and preserves an existing neighboring database',async t=>{
 const f=await fixture(t,{count:1}),privateDir=path.join(f.root,'private');await fs.mkdir(privateDir)
 const archive=path.join(privateDir,'rc7-owned-safety.zip'),neighbor=path.join(privateDir,'rc7-owned-safety.db')
 await fs.writeFile(neighbor,'existing database must survive')
 const {execFileSync}=await import('node:child_process')
 execFileSync('python3',['-c','import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],"w"); z.writestr("data.db",b"fake owned fixture"); z.close()',archive])
 const inventory=new URL('../../hosted/backup-inventory.py',import.meta.url).pathname
 assert.throws(()=>execFileSync('python3',[inventory,archive],{stdio:'pipe'}))
 assert.equal(await fs.readFile(neighbor,'utf8'),'existing database must survive')
 const unrelated=path.join(privateDir,'customer.zip');await fs.writeFile(unrelated,'unrelated bytes')
 assert.throws(()=>execFileSync('python3',[inventory,unrelated],{stdio:'pipe'}))
 assert.equal(await fs.readFile(unrelated,'utf8'),'unrelated bytes')
})

test('Safari CI configuration accepts only public same-origin fixture data, never credentials',async t=>{
 const f=await fixture(t,{count:1}),{publicSafariConfig}=await import('../../hosted/safari-config.mjs')
 const input={environmentId:f.c.environmentId,cmsOrigin:'https://rc7-owned-test.up.railway.app',cmsProbePath:f.c.cmsProbePath,publicPages:[{url:'https://rc7-owned-test.up.railway.app/',headings:f.c.publicPages[0].headings}]}
 const c=await publicSafariConfig(input);assert.deepEqual(c.actors,[]);assert.equal(c.devices[0].capabilities.browserName,'safari');assert.equal(c.devices[0].physical,false)
 await assert.rejects(publicSafariConfig({...input,password:'must never enter CI'}),/Only public fixture/)
 await assert.rejects(publicSafariConfig({...input,publicPages:[{...input.publicPages[0],url:'https://another.up.railway.app/'}]}),/same-origin/)
 await assert.rejects(publicSafariConfig({...input,cmsOrigin:'https://production.example.com'}),/disposable provider/)
})

test('Safari editor credentials are restricted to a fresh scoped QA identity and its exact marked origin',async()=>{
 const {validateSafariActor}=await import('../../hosted/safari-editor.mjs')
 const config={cmsOrigin:'https://rc7-owned-test.up.railway.app',environmentId:'only-this-qa-marker'}
 const actor={...config,email:'safari-ci-aabbcc@primo-qa.invalid',password:'Generated-unique-password-for-QA-only',siteId:id('s',1),sectionId:id('c',1),userId:id('u',1)}
 validateSafariActor(actor,config)
 for(const bad of [{cmsOrigin:'https://other.up.railway.app'},{environmentId:'another'},{email:'person@example.com'},{password:'short'},{siteId:'foreign'}])assert.throws(()=>validateSafariActor({...actor,...bad},config))
})

test('Safari handoff waits through intermediate auth redirects and an empty dashboard before opening the assigned site',async()=>{
 const {openScopedSafariSite}=await import('../../hosted/safari-editor.mjs'),origin='https://rc7-owned-test.up.railway.app'
 let reads=0,cards=0,clicked=false
 const command=async(method,route,body)=>{
  if(method==='GET'){reads++;return origin+(reads===1?'/admin':'/admin/dashboard/sites')}
  if(route.endsWith('/execute/sync'))return {count:++cards===1?0:1,href:origin+'/admin/site'}
  if(route.endsWith('/element')){assert.ok(reads>=3);return {'element-6066-11e4-a52e-4f735466cecf':'assigned'}}
  if(route.endsWith('/click')){clicked=true;return null}
  assert.fail('Unexpected WebDriver command')
 }
 await openScopedSafariSite(command,'/session/owned',origin,{interval:1});assert.equal(clicked,true)
 let foreignClicked=false
 await assert.rejects(openScopedSafariSite(async(method,route)=>{
  if(method==='GET')return origin+'/admin/dashboard/sites'
  if(route.endsWith('/execute/sync'))return {count:1,href:'https://foreign.example/admin/site'}
  foreignClicked=true
 },'/session/owned',origin),/escaped/)
 assert.equal(foreignClicked,false)
})
