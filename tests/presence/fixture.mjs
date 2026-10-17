import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import {randomBytes,createHash} from 'node:crypto'
import {spawn,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {createRequire} from 'node:module'
import {setTimeout as delay} from 'node:timers/promises'
import {lookup} from 'node:dns/promises'
export {assert,fs,path,delay}
const exec=promisify(execFile),require=createRequire(import.meta.url)
export async function fixture(t) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'primo-presence-')),binary=path.resolve(process.env.PRIMO_TEST_CMS_BINARY||'primo')
 const manifest=JSON.parse(await fs.readFile('tests/staging/rc8-packages.json','utf8')),version=process.env.PRIMO_EXPECTED_CMS_VERSION||manifest.cms.version
 const password=randomBytes(30).toString('hex'),secrets=[password]
 let child,logs=''
 t.after(async()=>{if(child&&child.exitCode===null){const closed=new Promise(resolve=>child.once('close',resolve));child.kill('SIGTERM');await closed}await fs.rm(root,{recursive:true,force:true,maxRetries:30,retryDelay:100})})
 const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve))
 // Only a fresh local process is accepted; no hosted/production origin input.
 const hostname=process.env.PRIMO_PRESENCE_HOST||'127.0.0.1'
 assert.ok(hostname==='127.0.0.1'||hostname==='primo-presence.test')
 if(hostname!=='127.0.0.1'){assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal((await lookup(hostname,{family:4})).address,'127.0.0.1')}
 const origin='http://'+hostname+':'+port,env={...process.env,HOME:root,USERPROFILE:root,PRIMO_DEV_MODE:'0',PRIMO_ENABLE_USAGE_STATS:'false',PRIMO_AUTHOR_MODE:'both',PRIMO_SUPERUSER_EMAIL:'operator@presence.example.test',PRIMO_SUPERUSER_PASSWORD:password,PRIMO_USER_EMAIL:'',PRIMO_USER_PASSWORD:''}
 child=spawn(binary,['serve','--http=127.0.0.1:'+port,'--dir='+path.join(root,'pb_data')],{env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b)
 let ready=false;for(let n=0;n<250;n++){try{if((await fetch(origin+'/api/health')).ok){ready=true;break}}catch{}if(child.exitCode!==null)break;await delay(100)}assert.ok(ready,'Disposable production-mode server did not start')
 const api=async(route,{method='GET',body,token}={})=>{assert.ok(route.startsWith('/')&&!route.startsWith('//'));const response=await fetch(origin+route,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});assert.ok(response.ok,method+' '+route.split('?')[0]+' HTTP '+response.status);return response.status===204?null:response.json()}
 const login=async(email,userPassword,superuser=false)=>{await delay(1700);const auth=await api('/api/collections/'+(superuser?'_superusers':'users')+'/auth-with-password',{method:'POST',body:{identity:email,password:userPassword}});secrets.push(auth.token,userPassword);return auth}
 const admin=await login('operator@presence.example.test',password,true)
 const info=await api('/api/primo/info');assert.equal(info.version,version);assert.equal(info.dev_mode,false);assert.equal(info.smtp_enabled,false);assert.equal((await fetch(origin+'/api/primo/dev-auth',{method:'POST'})).status,404)
 const create=(name,body)=>api('/api/collections/'+name+'/records',{method:'POST',body,token:admin.token})
 const group=await create('site_groups',{name:'Disposable browser checks',index:0}),site=await create('sites',{name:'Presence QA',host:new URL(origin).host,group:group.id}),foreign=await create('sites',{name:'Foreign site',host:'foreign.presence.example.test',group:group.id})
 const actors={}
 for(const [name,role]of [['builder','developer'],['editor','editor']]){
  const userPassword=randomBytes(24).toString('hex'),email=name+'@presence.example.test'
  const user=await create('users',{email,password:userPassword,passwordConfirm:userPassword,name:'Presence '+name,serverRole:'',verified:true});await create('site_role_assignments',{site:site.id,user:user.id,role});actors[name]={email,password:userPassword,auth:await login(email,userPassword)}
 }
 const cli=path.resolve('node_modules/primo-cli/dist/index.js'),mcp=require.resolve('primo-mcp'),work=path.join(root,'work'),home=path.join(root,'cli-home');await fs.mkdir(work);await fs.mkdir(path.join(home,'.primo'),{recursive:true,mode:0o700})
 const redact=text=>{for(const secret of secrets)text=text.replaceAll(secret,'[REDACTED]');return text.replace(/eyJ[A-Za-z0-9_.-]{30,}/g,'[REDACTED-TOKEN]')}
 const command=async(args,auth=actors.builder.auth)=>{
  await fs.writeFile(path.join(home,'.primo/tokens.json'),JSON.stringify({[origin]:auth.token}),{mode:0o600})
  try{return await exec(process.execPath,[cli,...args],{cwd:work,env:{...env,HOME:home,USERPROFILE:home,PRIMO_BINARY:binary,PRIMO_MCP_LOCAL:mcp},timeout:120000,maxBuffer:8*1024*1024})}catch(error){throw Error(redact('Built CLI failed: '+args[0]+' '+error.stdout+' '+error.stderr))}
 }
 await command(['init','--no-mcp']);await command(['new','presence','--skip-dev']);const local=path.join(work,'sites/presence')
 for(const name of ['blocks','pages','page-types','site'])await fs.rm(path.join(local,name),{recursive:true,force:true})
 const files={'blocks/qa-probe/config.yaml':'name: QA Probe\n','page-types/default/config.yaml':'name: Default\nallowed_blocks: [qa-probe]\n','site/head.svelte':'<title>Disposable presence QA</title>'}
 for(const [name,value]of Object.entries(files)){const file=path.join(local,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,value)}
 for(const [from,to]of [['qa-block.svelte','blocks/qa-probe/component.svelte'],['qa-fields.yaml','blocks/qa-probe/fields.yaml'],['qa-content.example.yaml','blocks/qa-probe/content.yaml'],['qa-page.example.yaml','pages/index.yaml']]){
  const file=path.join(local,to);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,(await fs.readFile(new URL('../staging/launch/fixtures/'+from,import.meta.url),'utf8')).replaceAll('REPLACE_WITH_UNIQUE_DISPOSABLE_ENVIRONMENT','disposable-presence-qa'))
 }
 await fs.writeFile(path.join(local,'site.yaml'),require('js-yaml').dump({name:site.name,site_id:site.id,server:origin,host:site.host,group:group.id}))
 await command(['push','--server',origin,'--dir',local,'--force','--yes','--json'])
 const list=async(name,token=actors.editor.auth.token)=>(await api('/api/collections/'+name+'/records?perPage=200&sort=id',{token})).items
 const fields=await list('site_symbol_fields'),sections=(await list('page_sections')).sort((a,b)=>a.index-b.index),entries=()=>list('page_section_entries')
 assert.equal(sections.length,5);const section=sections[0],before=await entries(),heading=before.find(e=>e.section===section.id&&e.field===fields.find(f=>f.key==='heading').id)
 const verifyContent=async(expectedHeading=heading.value)=>{const after=await entries();assert.deepEqual(after.map(e=>e.id),before.map(e=>e.id));for(const old of before){const now=after.find(e=>e.id===old.id);for(const key of ['field','section','parent','locale','value'])assert.deepEqual(now[key],old.id===heading.id&&key==='value'?expectedHeading:old[key])}return after}
 const provenance={sourceCommit:process.env.PRIMO_CANDIDATE_SHA||null,version,binarySha256:createHash('sha256').update(await fs.readFile(binary)).digest('hex'),productionMode:true,cli:'0.3.0-rc.2',mcp:'0.1.11-rc.2',loopbackOnly:true,realUserData:false,emailSent:false,clientSitePublication:false}
 return {root,origin,api,actors,admin,site,foreign,fields,section,heading,before,entries,list,command,verifyContent,redact,provenance}
}
