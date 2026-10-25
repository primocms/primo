import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import {spawn,execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {createHash} from 'node:crypto'
const exec=promisify(execFile)

test('native production validation supports page create/update and exact CLI publication', {timeout:120000}, async t=>{
 const binary=path.resolve(process.env.PRIMO_TEST_CMS_BINARY),root=await fs.mkdtemp(path.join(os.tmpdir(),'primo-production-native-'))
 let child,logs=''
 t.after(async()=>{if(child&&child.exitCode===null){const closed=new Promise(r=>child.once('close',r));child.kill('SIGTERM');await closed}await fs.rm(root,{recursive:true,force:true,maxRetries:30,retryDelay:100})})
 const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r));const server=`http://127.0.0.1:${port}`
 const password='DisposableNativePassword123!',env={...process.env,HOME:root,USERPROFILE:root,PRIMO_DEV_MODE:'0',PRIMO_ENABLE_USAGE_STATS:'false',PRIMO_SUPERUSER_EMAIL:'super@qa.example.test',PRIMO_SUPERUSER_PASSWORD:password,PRIMO_USER_EMAIL:'admin@qa.example.test',PRIMO_USER_PASSWORD:password}
 child=spawn(binary,['serve','--http',`127.0.0.1:${port}`,'--dir',path.join(root,'pb_data')],{env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b)
 let ready=false;for(let i=0;i<300;i++){try{if((await fetch(server+'/api/health')).ok){ready=true;break}}catch{}if(child.exitCode!==null)break;await delay(100)}assert.ok(ready,logs)
 let token
 const api=async(route,body,method=body===undefined?'GET':'POST')=>{const r=await fetch(server+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});assert.ok(r.ok,`${method} ${route}: ${r.status} ${await r.clone().text()}`);return r.status===204?null:r.json()}
 const info=await api('/api/primo/info');assert.equal(info.dev_mode,false);assert.equal(info.version,'v3.3.2-rc.12');assert.equal((await fetch(server+'/api/primo/dev-auth',{method:'POST'})).status,404)
 token=(await api('/api/collections/users/auth-with-password',{identity:'admin@qa.example.test',password})).token
 const group=await api('/api/collections/site_groups/records',{name:'Production',index:0})
 const site=await api('/api/collections/sites/records',{name:'Production',group:group.id,host:`127.0.0.1:${port}`})
 const type=await api('/api/collections/page_types/records',{name:'Default',site:site.id})
 const page=await api('/api/collections/pages/records',{name:'Home',slug:'',site:site.id,page_type:type.id})
 const updated=await api(`/api/collections/pages/records/${page.id}`,{name:'Renamed'},'PATCH');assert.equal(updated.created,page.created)
 const block=await api('/api/collections/site_symbols/records',{site:site.id,name:'Hero',html:'<h1>{heading}</h1>',js:'let {heading}=$props()',css:'h1 {color:red}'})
 const field=await api('/api/collections/site_symbol_fields/records',{symbol:block.id,key:'heading',type:'text'})
 const section=await api('/api/collections/page_sections/records',{page:page.id,symbol:block.id,index:0})
 const entry=await api('/api/collections/page_section_entries/records',{section:section.id,field:field.id,locale:'en',value:'Production publication'})
 const cli=path.resolve('node_modules/primo-cli/dist/bootstrap.js')
 await exec(process.execPath,[cli,'publish','--server',server,'--site',site.id,'--token',token,'--json'],{cwd:root,env,timeout:60000,maxBuffer:4*1024*1024})
 const publicPage=await fetch(server);assert.equal(publicPage.status,200);assert.equal(publicPage.headers.get('content-security-policy'),"frame-ancestors 'self'");assert.match(await publicPage.text(),/Production publication/)
 const retained=await api(`/api/collections/page_section_entries/records/${entry.id}`);assert.equal(retained.value,'Production publication');assert.equal(retained.id,entry.id)
 await fs.writeFile('production-result.json',JSON.stringify({sourceCommit:process.env.PRIMO_CANDIDATE_SHA,version:info.version,binarySha256:createHash('sha256').update(await fs.readFile(binary)).digest('hex'),devMode:false,productionPageCreateUpdate:true,actualInstalledCLIPublication:true,contentIdentityRetained:true},null,2)+'\n')
})
