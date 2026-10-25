import {createHash} from 'node:crypto'
import {context,fs,path,invariant} from './lib.mjs'
const c=await context(),actor=JSON.parse(await fs.readFile(path.join(c.run,'private/actors.json'),'utf8'))[0]
const auth=await c.login(actor.email,actor.password)
// Small generated PNG fixtures, matching the existing content-persistence tests.
const images=[
 'iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAkElEQVR4nO3RMREAIBDAsJeIJjThD2TQIUP23nXOXpeO+R2AIWmGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0jMA8FGOIiljfewAAAAAElFTkSuQmCC',
 'iVBORw0KGgoAAAANSUhEUgAAAGQAAAAyCAYAAACqNX6+AAAAkUlEQVR4nO3RMREAIBDAsFfCjH8VuAIZdMiQvXeds/alY34HYEiaITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgSY0iMITGGxBgS8wAggBBBW13NdQAAAABJRU5ErkJggg=='
].map(s=>Buffer.from(s,'base64'))
const hash=b=>createHash('sha256').update(b).digest('hex'),names=[]
let upload
const report={status:'FAIL',checks:[],productionChanged:false,canariesChanged:false,cleanupVerified:false}
const publish=()=>c.command(['publish','--server',c.state.cmsOrigin,'--site',actor.siteId,'--token',auth.token,'--json'])
async function transfer(bytes){
 const form=new FormData();if(!upload)form.append('site',actor.siteId)
 form.append('file',new Blob([bytes],{type:'image/png'}),'rc7-owned-upload.png')
 const response=await fetch(c.state.cmsOrigin+'/api/collections/site_uploads/records'+(upload?'/'+upload.id:''),{method:upload?'PATCH':'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:'Bearer '+auth.token},body:form})
 invariant(response.ok,'Synthetic client image upload failed: HTTP '+response.status)
 const record=await response.json();invariant(record.site===actor.siteId && (!upload||record.id===upload.id),'Upload identity changed')
 upload=record;names.push(record.file)
 const file=await fetch(c.state.cmsOrigin+'/api/files/site_uploads/'+upload.id+'/'+encodeURIComponent(upload.file),{redirect:'error',signal:AbortSignal.timeout(30000)})
 invariant(file.ok && hash(Buffer.from(await file.arrayBuffer()))===hash(bytes),'Uploaded image bytes differ')
}
async function publicBytes(name){const r=await fetch(c.state.cmsOrigin+'/_uploads/'+encodeURIComponent(name),{redirect:'error',signal:AbortSignal.timeout(30000)});return {status:r.status,bytes:Buffer.from(await r.arrayBuffer())}}
try{
 await transfer(images[0]);await publish()
 let published=await publicBytes(upload.file);invariant(published.status===200 && hash(published.bytes)===hash(images[0]),'First published image missing or stale')
 await transfer(images[1]);invariant(names[0]!==names[1],'Replacement image must receive a new immutable filename');await publish()
 published=await publicBytes(upload.file);invariant(published.status===200 && hash(published.bytes)===hash(images[1]),'Replacement published image missing or stale')
 invariant((await publicBytes(names[0])).status===404,'Retired image remains publicly served after replacement')
 report.checks=['Content-only editor uploads a PNG; stored and published bytes match','Replacing the same upload keeps record/site identity, uses a new filename and publishes exact new bytes','Retired image returns HTTP 404 after republication']
}catch(error){report.failure=c.redact(error.stack);process.exitCode=1}finally{
 try{if(upload){
  const current=await c.ok('/api/collections/site_uploads/records/'+upload.id,{token:auth.token})
  invariant(current.site===actor.siteId && current.file===upload.file,'Unexpected upload edit; preserving it')
  await c.ok('/api/collections/site_uploads/records/'+upload.id,{method:'DELETE',token:auth.token});await publish()
  for(const name of names)invariant((await publicBytes(name)).status===404,'Deleted owned image still publicly served')
  report.cleanupVerified=true
 }else report.cleanupVerified=true
 }catch(error){report.cleanupFailure=c.redact(error.stack);process.exitCode=1}
 if(!report.failure && report.cleanupVerified)report.status='PASS_HOSTED_CLIENT_IMAGE_REPUBLICATION'
 await c.save('hosted-uploads.json',report);console.log(JSON.stringify({status:report.status,cleanupVerified:report.cleanupVerified}))
}
