import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import {spawn} from 'node:child_process'
import {createHash,randomBytes} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'

test('exact managed candidate seeds plans, preserves owner policy after secret removal and fails closed', {timeout:120000},async t=>{
 const binary=path.resolve(process.env.PRIMO_TEST_CMS_BINARY),root=await fs.mkdtemp(path.join(os.tmpdir(),'primo-hosted-native-')),hash=createHash('sha256').update(await fs.readFile(binary)).digest('hex'),password=randomBytes(28).toString('base64url')+'Aa1!'
 let child,origin,logs=''
 const stop=async()=>{if(child&&child.exitCode===null){const closed=new Promise(r=>child.once('close',r));child.kill('SIGTERM');await closed}child=null}
 t.after(async()=>{await stop();await fs.rm(root,{recursive:true,force:true,maxRetries:30,retryDelay:100})})
 const start=async(name,changes={})=>{
  await stop();const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));origin='http://127.0.0.1:'+port;logs=''
  const env={...process.env,HOME:root,USERPROFILE:root,PRIMO_DEV_MODE:'0',PRIMO_ENABLE_USAGE_STATS:'false',PRIMO_HOSTED_MODE:'true',PRIMO_MANAGED_BOOTSTRAP:'true',PRIMO_OWNER_ONLY:'true',PRIMO_SITE_CAP:'3',PRIMO_EDITOR_CAP:'0',PRIMO_DOMAIN_PROVIDER:'fly',FLY_APP_NAME:'primo-local-contract',PRIMO_FLY_TOKEN:'local-only-app-scoped-placeholder',PRIMO_BASE_DOMAIN:'workspace.primo-qa.invalid',PRIMO_APP_URL:'https://workspace.primo-qa.invalid',PRIMO_SUPERUSER_EMAIL:'operator@primo-qa.invalid',PRIMO_SUPERUSER_PASSWORD:password,PRIMO_USER_EMAIL:'purchaser@primo-qa.invalid',PRIMO_USER_PASSWORD:password,...changes}
  child=spawn(binary,['serve','--http=127.0.0.1:'+port,'--dir='+path.join(root,name)],{env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b)
  for(let n=0;n<150;n++){try{if((await fetch(origin+'/api/health',{signal:AbortSignal.timeout(1000)})).ok)return true}catch{}if(child.exitCode!==null)return false;await delay(100)}return false
 }
 let token
 const api=async(route,body,method=body===undefined?'GET':'POST')=>{const r=await fetch(origin+route,{method,redirect:'error',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});assert.ok(r.ok,`${method} ${route}: ${r.status}`);return r.status===204?null:r.json()}
 assert.ok(await start('maker'),'Managed first boot must succeed with actual plan flags')
 const info=await api('/api/primo/info');assert.equal(info.version,'v3.3.2-rc.13');assert.equal(info.dev_mode,false);assert.equal(info.hosted_mode,true);assert.equal(info.managed_bootstrap,true);assert.equal(info.owner_only,true);assert.equal(info.site_cap,3);assert.equal(info.domain_provider,'fly')
 const auth=await api('/api/collections/users/auth-with-password',{identity:'purchaser@primo-qa.invalid',password});token=auth.token;assert.equal(auth.record.serverRole,'developer')
 const group=await api('/api/collections/site_groups/records',{name:'Owner workspace',index:0})
 for(let n=0;n<3;n++)await api('/api/collections/sites/records',{name:'Site '+n,host:'site-'+n+'.workspace.primo-qa.invalid',group:group.id})
 let denied=await fetch(origin+'/api/collections/sites/records',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({name:'Above plan',host:'too-many.workspace.primo-qa.invalid',group:group.id})});assert.equal(denied.status,400);assert.match((await denied.json()).message,/Site limit reached/);assert.equal((await api('/api/collections/sites/records?perPage=100')).totalItems,3)
 denied=await fetch(origin+'/api/collections/users/records',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({email:'extra@primo-qa.invalid',password,passwordConfirm:password})});assert.equal(denied.status,403)
 const profile=await api('/api/collections/users/records/'+auth.record.id,{name:'Retained purchaser'},'PATCH');assert.equal(profile.id,auth.record.id)
 assert.ok(await start('maker',{PRIMO_SUPERUSER_EMAIL:'',PRIMO_SUPERUSER_PASSWORD:'',PRIMO_USER_EMAIL:'',PRIMO_USER_PASSWORD:''}),'Managed restart must retain accounts and owner policy after removing bootstrap secrets')
 token=null;const again=await api('/api/collections/users/auth-with-password',{identity:'purchaser@primo-qa.invalid',password});token=again.token;assert.equal(again.record.id,auth.record.id);assert.equal(again.record.name,'Retained purchaser');assert.equal((await api('/api/collections/sites/records?perPage=100')).totalItems,3);assert.equal((await api('/api/primo/info')).owner_only,true)
 for(const [name,changes]of [
  ['missing',{PRIMO_OWNER_ONLY:'false',PRIMO_SUPERUSER_EMAIL:'',PRIMO_SUPERUSER_PASSWORD:'',PRIMO_USER_EMAIL:'',PRIMO_USER_PASSWORD:''}],
  ['invalid-admin',{PRIMO_SUPERUSER_EMAIL:'invalid-address'}],
  ['invalid-customer',{PRIMO_USER_PASSWORD:'short'}]
 ]){assert.equal(await start(name,changes),false,'Managed '+name+' must never listen');assert.match(logs,/bootstrap|migration|password|email/i)}
 await fs.writeFile('hosted-native-result.json',JSON.stringify({status:'PASS',version:info.version,sourceCommit:process.env.PRIMO_CANDIDATE_SHA,binarySha256:hash,freshPlanConfiguredBoot:true,ownerOnlyAPIEnforced:true,siteCapEnforced:true,ownerIdAndContentRetainedAfterSecretRemoval:true,managedBootstrapMissingInvalidCredentialsFailBeforeListen:true,cloudCalls:false},null,2)+'\n')
})
