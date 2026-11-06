import {randomUUID,createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {context,fs,path,delay,invariant} from './lib.mjs'
const c=await context(),{state,run}=c
invariant(state.restoreServiceId && state.restoreServiceId!==state.serviceId && state.restoreOrigin!==state.cmsOrigin,'A separate empty restore service is required')
invariant(new URL(state.restoreOrigin).hostname.endsWith('.up.railway.app') && new URL(state.restoreOrigin).origin===state.restoreOrigin,'Restore target must be the owned provider origin')
const verifyExisting=process.argv.includes('--verify-existing-restore')
const cloneCredentials=JSON.parse(await fs.readFile(path.join(run,'private/restore-bootstrap.json'),'utf8'));c.secrets.add(cloneCredentials.password)
async function remote(origin,route,{method='GET',body,token,timeout=180000}={}){
 const response=await fetch(new URL(route,origin),{method,redirect:'error',signal:AbortSignal.timeout(timeout),headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined || body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)})
 invariant(response.ok,'Owned backup/restore API failed: '+route.split('?')[0]+' HTTP '+response.status)
 return response
}
const read=async(origin,route,options)=>(await remote(origin,route,options)).json()
const before=await read(state.restoreOrigin,'/api/primo/info')
invariant(before.version==='v3.3.2-rc.7' && before.dev_mode===false && (verifyExisting || before.site_count===0),'Restore target is not a fresh empty RC.7 test service')
const admin=await c.login(c.credentials.adminEmail,c.credentials.adminPassword,true)
// Backups include auth/settings. Prove this is only the newly generated QA dataset
// and contains no external mail or storage credentials before exporting anything.
const sourceActors=JSON.parse(await fs.readFile(path.join(run,'private/actors.json'),'utf8'))
const workflow=JSON.parse(await fs.readFile(path.join(run,'evidence/workflow.json'),'utf8'))
const ownedSites=new Set([...sourceActors.map(x=>x.siteId),workflow.siteId])
const sites=await c.ok('/api/collections/sites/records?perPage=500',{token:admin.token})
invariant(sites.totalItems===ownedSites.size && sites.items.length===ownedSites.size && sites.items.every(x=>ownedSites.has(x.id)),'Unexpected site outside this generated QA dataset')
for(const collection of ['users','_superusers']){
 const accounts=await c.ok('/api/collections/'+collection+'/records?perPage=500',{token:admin.token})
 invariant(accounts.totalItems===accounts.items.length && accounts.items.every(x=>x.email.endsWith('@primo-qa.invalid')),'Unexpected account outside reserved test email domain')
}
const settings=await c.ok('/api/settings',{token:admin.token})
invariant(settings.smtp?.host==='rc7-mail-capture.railway.internal' && !settings.smtp.username && !settings.smtp.password && !settings.s3?.enabled && !settings.backups?.s3?.enabled,'External mail or storage configuration cannot be copied')
await c.save('backup-scope-verification.json',{onlyGeneratedSites:true,siteCount:sites.totalItems,onlyReservedInvalidEmailAccounts:true,noExternalMailCredentials:true,noExternalObjectStorage:true,separateEmptyRestore:true,sourceProjectId:state.projectId,sourceServiceId:state.serviceId,restoreServiceId:state.restoreServiceId,verifiedUtc:new Date().toISOString()})
let inventory,file
if(verifyExisting){
 inventory=JSON.parse(await fs.readFile(path.join(run,'private/backup-expected.json'),'utf8'))
 for(const name of await fs.readdir(path.join(run,'private'))){
  if(!/^rc7-owned-[a-z0-9-]+\.zip$/.test(name))continue
  const candidateFile=path.join(run,'private',name)
  if(createHash('sha256').update(await fs.readFile(candidateFile)).digest('hex')===inventory.archiveSha256){file=candidateFile;break}
 }
 invariant(file && before.site_count===inventory.tables.sites.length,'Prior owned backup and restored site count must match before verification-only retry')
}else{
 await delay(1700)
 const cloneAuth=await read(state.restoreOrigin,'/api/collections/_superusers/auth-with-password',{method:'POST',body:{identity:cloneCredentials.email,password:cloneCredentials.password}});c.secrets.add(cloneAuth.token)
 const name='rc7-owned-'+randomUUID()+'.zip';file=path.join(run,'private',name)
 await remote(state.cmsOrigin,'/api/backups',{method:'POST',body:{name},token:admin.token})
 const list=await c.ok('/api/backups',{token:admin.token});invariant(list.some(x=>x.key===name && x.size>0),'Native backup was not created')
 const fileToken=(await c.ok('/api/files/token',{method:'POST',body:{},token:admin.token})).token;c.secrets.add(fileToken)
 const download=await remote(state.cmsOrigin,'/api/backups/'+encodeURIComponent(name)+'?token='+encodeURIComponent(fileToken),{token:admin.token})
 const bytes=Buffer.from(await download.arrayBuffer());invariant(bytes.length<128*1024*1024,'Owned QA backup exceeds the expected test bound')
 await fs.writeFile(file,bytes,{flag:'wx',mode:0o600})
 inventory=JSON.parse(execFileSync('python3',[path.resolve(import.meta.dirname,'backup-inventory.py'),file],{encoding:'utf8',maxBuffer:64*1024*1024}))
 await c.save('backup-expected.json',inventory,true)
 const form=new FormData();form.append('file',new Blob([bytes],{type:'application/zip'}),name)
 await remote(state.restoreOrigin,'/api/backups/upload',{method:'POST',token:cloneAuth.token,body:form})
 await remote(state.restoreOrigin,'/api/backups/'+encodeURIComponent(name)+'/restore',{method:'POST',token:cloneAuth.token,body:{}})
 let restored=false
 for(let n=0;n<90;n++){
  await delay(1000)
  try{const info=await read(state.restoreOrigin,'/api/primo/info',{timeout:5000});if(info.site_count===inventory.tables.sites.length){restored=true;break}}catch{}
 }
 invariant(restored,'Restored copy did not recover the expected site count')
}
await delay(1700)
const auth=await read(state.restoreOrigin,'/api/collections/_superusers/auth-with-password',{method:'POST',body:{identity:c.credentials.adminEmail,password:c.credentials.adminPassword}});c.secrets.add(auth.token)
const report={status:'FAIL',sourceOrigin:state.cmsOrigin,restoreOrigin:state.restoreOrigin,nativeBackupSha256:inventory.archiveSha256,sourceSoakWasNotStopped:true,verificationOnlyRetry:verifyExisting,restoredTables:{},verifiedStoredFiles:0,verifiedPublicFileDownloads:0,productionChanged:false}
const canonical=value=>JSON.stringify(value && typeof value==='object' ? Array.isArray(value)?value.map(v=>JSON.parse(canonical(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonical(value[k]))])) : value)
for(const [table,rows] of Object.entries(inventory.tables)){
 const actual=[]
 for(let page=1;;page++){
  const response=await read(state.restoreOrigin,'/api/collections/'+table+'/records?perPage=500&page='+page+'&sort=id',{token:auth.token})
  actual.push(...response.items);if(page>=response.totalPages)break
 }
 invariant(actual.length===rows.length,'Restored collection count differs: '+table)
 for(const expected of rows){
  const record=actual.find(x=>x.id===expected.id);invariant(record,'Restored record ID missing: '+table)
  for(const [key,raw] of Object.entries(expected)){
   let value=raw
   if(['compiled_html','compiled_js','file'].includes(key) && Array.isArray(value) && typeof record[key]==='string' && value.length<=1)value=value[0] || ''
   if(value===null && record[key]==='')value=''
   invariant(canonical(record[key])===canonical(value),'Restored value/binding differs: '+table+'/'+key)
  }
 }
 report.restoredTables[table]=rows.length
}
// A fresh clone-side native snapshot exposes storage metadata sidecars too;
// these intentionally cannot be downloaded through the public file API.
const cloneBackup='rc7-owned-restore-verification-'+randomUUID()+'.zip'
await remote(state.restoreOrigin,'/api/backups',{method:'POST',body:{name:cloneBackup},token:auth.token})
const token=(await read(state.restoreOrigin,'/api/files/token',{method:'POST',body:{},token:auth.token})).token;c.secrets.add(token)
const cloneBytes=Buffer.from(await (await remote(state.restoreOrigin,'/api/backups/'+encodeURIComponent(cloneBackup)+'?token='+encodeURIComponent(token),{token:auth.token})).arrayBuffer())
invariant(cloneBytes.length<128*1024*1024,'Clone snapshot exceeds the synthetic test bound')
const cloneFile=path.join(run,'private',cloneBackup);await fs.writeFile(cloneFile,cloneBytes,{flag:'wx',mode:0o600})
const cloneInventory=JSON.parse(execFileSync('python3',[path.resolve(import.meta.dirname,'backup-inventory.py'),cloneFile],{encoding:'utf8',maxBuffer:64*1024*1024}))
invariant(canonical(cloneInventory.fileHashes)===canonical(inventory.fileHashes),'Restored storage bytes or metadata differ from the original snapshot')
report.verifiedStoredFiles=Object.keys(inventory.fileHashes).length
for(const [member,expected] of Object.entries(inventory.fileHashes)){
 const parts=member.split('/');if(parts.length!==4 || member.endsWith('.attrs'))continue // Metadata and thumbnails were compared in the clone snapshot above.
 const route='/api/files/'+parts.slice(1).map(encodeURIComponent).join('/')+'?token='+encodeURIComponent(token)
 const response=await remote(state.restoreOrigin,route,{token:auth.token})
 invariant(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')===expected,'Restored original file bytes differ')
 report.verifiedPublicFileDownloads++
}
const actors=sourceActors
await delay(1700)
const client=await read(state.restoreOrigin,'/api/collections/users/auth-with-password',{method:'POST',body:{identity:actors[0].email,password:actors[0].password}})
invariant(client.record.id===actors[0].userId && !client.record.serverRole,'Restored client authentication or role differs')
const page=await remote(state.restoreOrigin,'/?_site='+actors[0].siteId)
invariant((await page.text()).includes(c.state.environmentMarker),'Restored active publication did not render')
invariant(createHash('sha256').update(await fs.readFile(file)).digest('hex')===inventory.archiveSha256,'Pristine native backup bytes changed')
report.status='PASS_HOSTED_NATIVE_BACKUP_AND_SEPARATE_RESTORE';report.scope='Agent-generated synthetic staging data; not a representative customer legacy backup';report.backupContainsMidSoakCanaryValues=true
await c.save('hosted-backup-restore.json',report);console.log(JSON.stringify(report,null,2))
