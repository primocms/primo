import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { createHash } from 'node:crypto'
const exec=promisify(execFile)
const binary=path.resolve(process.env.PRIMO_TEST_CMS_BINARY)
const expected='v3.3.2-rc.3'

test('native candidate starts, edits content safely, survives restart and builds with the packaged CLI', {timeout:120000}, async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'primo-native-'));let child,logs=''
 const stop=async()=>{if(child&&child.exitCode===null){const closed=new Promise(r=>child.once('close',r));child.kill('SIGTERM');await closed}}
 t.after(async()=>{await stop();await fs.rm(root,{recursive:true,force:true,maxRetries:30,retryDelay:100})})
 assert.ok((await exec(binary,['--version'])).stdout.includes(expected))
 const reserve=net.createServer();await new Promise(r=>reserve.listen(0,'127.0.0.1',r));const port=reserve.address().port;await new Promise(r=>reserve.close(r))
 const server=`http://127.0.0.1:${port}`,env={...process.env,HOME:root,USERPROFILE:root,PRIMO_DEV_MODE:'1',PRIMO_AUTHOR_MODE:'both',PRIMO_ENABLE_USAGE_STATS:'false'}
 let token
 const api=async(route,{method='GET',body,auth=token}={})=>{const r=await fetch(server+route,{method,headers:{Authorization:`Bearer ${auth}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});assert.ok(r.ok,`${method} ${route}: ${r.status} ${await r.clone().text()}\n${logs}`);return r.json()}
 const start=async()=>{
  child=spawn(binary,['serve','--http',`127.0.0.1:${port}`,'--dir',path.join(root,'pb_data')],{env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b)
  let ready=false;for(let i=0;i<300;i++){try{if((await fetch(server+'/api/health')).ok){ready=true;break}}catch{}if(child.exitCode!==null)break;await delay(100)}assert.ok(ready,logs)
  token=(await api('/api/primo/dev-auth',{method:'POST'})).token;assert.ok(token);assert.equal((await api('/api/primo/info')).version,expected)
 }
 await start()
 const group=await api('/api/collections/site_groups/records',{method:'POST',body:{name:'Native QA',index:0}})
 const site=await api('/api/collections/sites/records',{method:'POST',body:{name:'Native QA',group:group.id,host:'native-qa.example.test'}})
 const type=await api('/api/collections/page_types/records',{method:'POST',body:{site:site.id,name:'Default'}})
 const page=await api('/api/collections/pages/records',{method:'POST',body:{site:site.id,page_type:type.id,name:'Home',slug:''}})
 const block=await api('/api/collections/site_symbols/records',{method:'POST',body:{site:site.id,name:'Hero',html:'<h1>{heading}</h1>',js:'let {heading}=$props()',css:''}})
 const field=await api('/api/collections/site_symbol_fields/records',{method:'POST',body:{symbol:block.id,key:'heading',type:'text'}})
 const section=await api('/api/collections/page_sections/records',{method:'POST',body:{page:page.id,symbol:block.id,index:0}})
 const entry=await api('/api/collections/page_section_entries/records',{method:'POST',body:{section:section.id,field:field.id,locale:'en',value:'Native content'}})
 const user=await api('/api/collections/users/records',{method:'POST',body:{email:'native-editor@example.test',password:'NativePassword123!',passwordConfirm:'NativePassword123!'}})
 await api('/api/collections/site_role_assignments/records',{method:'POST',body:{site:site.id,user:user.id,role:'editor'}})
 const client=await api('/api/collections/users/auth-with-password',{method:'POST',body:{identity:'native-editor@example.test',password:'NativePassword123!'}})
 await api(`/api/collections/page_section_entries/records/${entry.id}`,{method:'PATCH',auth:client.token,body:{value:'Native client edit'}})
 for(const [route,body] of [[`site_symbols/records/${block.id}`,{html:'changed source'}],[`page_section_entries/records/${entry.id}`,{parent:entry.id}]]){
  const r=await fetch(`${server}/api/collections/${route}`,{method:'PATCH',headers:{Authorization:`Bearer ${client.token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,403,await r.text())
 }
 const editor=await fetch(server+'/admin');assert.ok(editor.ok);assert.match(await editor.text(),/<html/i)
 await stop();await start();assert.equal((await api(`/api/collections/page_section_entries/records/${entry.id}`)).value,'Native client edit');assert.equal((await api(`/api/collections/site_symbols/records/${block.id}`)).html,'<h1>{heading}</h1>')
 const cliWork=path.join(root,'work');await fs.mkdir(cliWork);
 const cliRoot=path.resolve('node_modules/primo-cli'),pkg=JSON.parse(await fs.readFile(path.join(cliRoot,'package.json'),'utf8'));assert.equal(pkg.version,'0.3.0-rc.2')
 const cli=async args=>exec(process.execPath,[path.join(cliRoot,pkg.bin.primo),...args],{cwd:cliWork,env,timeout:30000}).catch(e=>assert.fail(e.message+'\n'+e.stdout+'\n'+e.stderr))
 await cli(['init','--no-mcp']);
 const unused=net.createServer();await new Promise(r=>unused.listen(0,'127.0.0.1',r));const unusedPort=unused.address().port;await new Promise(r=>unused.close(r));await fs.writeFile(path.join(cliWork,'server.yaml'),`port: ${unusedPort}\n`);
 await cli(['new','client','--skip-dev']);await cli(['build','--dir',path.join(cliWork,'sites/client'),'--output',path.join(root,'public')]);assert.match(await fs.readFile(path.join(root,'public/index.html'),'utf8'),/<html/i)
 const evidence={sourceCommit:process.env.PRIMO_CANDIDATE_SHA,platform:process.platform,arch:process.arch,node:process.version,cms:expected,cli:pkg.version,sha256:createHash('sha256').update(await fs.readFile(binary)).digest('hex'),checks:['native version','migrations/startup','frontend HTTP','create page/block/field/content','client content edit','source/cycle denial','restart persistence','exact installed CLI static build']}
 await fs.writeFile('platform-result.json',JSON.stringify(evidence,null,2)+'\n');console.log(evidence)
})
