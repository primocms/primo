import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import {spawn, execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {setTimeout as delay} from 'node:timers/promises'
import {createHash} from 'node:crypto'
const exec = promisify(execFile)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

test('production upgrade and copied recovery retain content, image and publication; newer writes remain separate', {timeout:180000}, async t => {
 const candidate = path.resolve(process.env.PRIMO_TEST_CMS_BINARY)
 const previous = path.resolve(process.env.PRIMO_PREVIOUS_BINARY)
 const oldManifest = JSON.parse(await fs.readFile('tests/staging/launch/candidate.json', 'utf8'))
 const target = `${process.platform === 'win32' ? 'windows' : process.platform}_${process.arch === 'x64' ? 'amd64' : process.arch}`
 assert.ok(oldManifest.cms.nativeSha256ByTarget[target], `Unsupported prior artifact target: ${target}`)
 assert.equal(hash(await fs.readFile(previous)), oldManifest.cms.nativeSha256ByTarget[target])
 assert.match((await exec(previous, ['--version'])).stdout, /v3\.3\.2-rc\.7/)
 assert.match((await exec(candidate, ['--version'])).stdout, /v3\.3\.2-rc\.13/)
 const root = await fs.mkdtemp(path.join(os.tmpdir(), 'primo-rc8-recovery-'))
 let child, token, superToken, activeBinary = previous, version = 'v3.3.2-rc.7', data = path.join(root, 'original')
 const stop = async () => { if (child && child.exitCode === null) { const closed = new Promise(resolve => child.once('close', resolve)); child.kill('SIGTERM'); await closed } }
 t.after(async () => { await stop(); await fs.rm(root, {recursive:true,force:true,maxRetries:30,retryDelay:100}) })
 const reserve = net.createServer(); await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve))
 const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve))
 const origin = `http://127.0.0.1:${port}`
 const password = 'DisposableRecoveryPassword123!'
 const env = {...process.env,HOME:root,USERPROFILE:root,PRIMO_DEV_MODE:'0',PRIMO_ENABLE_USAGE_STATS:'false',PRIMO_SUPERUSER_EMAIL:'super@recovery.example.test',PRIMO_SUPERUSER_PASSWORD:password,PRIMO_USER_EMAIL:'owner@recovery.example.test',PRIMO_USER_PASSWORD:password}
 const api = async (route, body, method = body === undefined ? 'GET' : 'POST', auth = token) => {
  const response = await fetch(origin + route, {method,signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',...(auth ? {Authorization:`Bearer ${auth}`} : {})},body:body === undefined ? undefined : JSON.stringify(body)})
  assert.ok(response.ok, `${method} ${route}: ${response.status}`)
  return response.status === 204 ? null : response.json()
 }
 const start = async () => {
  child = spawn(activeBinary, ['serve','--http',`127.0.0.1:${port}`,'--dir',data], {env,stdio:['ignore','ignore','ignore']})
  let ready = false
  for (let i=0;i<300;i++) { try { if ((await fetch(origin+'/api/health')).ok) { ready=true;break } } catch {} if(child.exitCode!==null)break; await delay(100) }
  assert.ok(ready, 'Disposable server failed to start')
  const info = await api('/api/primo/info'); assert.equal(info.version,version); assert.equal(info.dev_mode,false)
  assert.equal((await fetch(origin+'/api/primo/dev-auth',{method:'POST'})).status,404)
  token = (await api('/api/collections/users/auth-with-password',{identity:'owner@recovery.example.test',password},'POST',null)).token
  superToken = (await api('/api/collections/_superusers/auth-with-password',{identity:'super@recovery.example.test',password},'POST',null)).token
 }
 await start()
 const create = (collection, body) => api(`/api/collections/${collection}/records`,body)
 const group = await create('site_groups',{name:'Recovery QA',index:0})
 const site = await create('sites',{name:'Recovery QA',group:group.id,host:`127.0.0.1:${port}`})
 const type = await create('page_types',{site:site.id,name:'Default'})
 const page = await create('pages',{site:site.id,page_type:type.id,name:'Home',slug:''})
 const block = await create('site_symbols',{site:site.id,name:'Hero',html:'<h1>{heading}</h1>{#each items as item}<p>{item.label}</p>{/each}',js:'let {heading,items=[]}=$props()',css:'h1{color:red}'})
 const heading = await create('site_symbol_fields',{symbol:block.id,key:'heading',type:'text'})
 const items = await create('site_symbol_fields',{symbol:block.id,key:'items',type:'repeater'})
 const label = await create('site_symbol_fields',{symbol:block.id,key:'label',type:'text',parent:items.id})
 const section = await create('page_sections',{page:page.id,symbol:block.id,index:0})
 const entry = await create('page_section_entries',{section:section.id,field:heading.id,locale:'en',value:'Before upgrade'})
 const item = await create('page_section_entries',{section:section.id,field:items.id,locale:'en',index:0})
 await create('page_section_entries',{section:section.id,field:label.id,parent:item.id,locale:'en',value:'Nested recovery value'})
 const user = await create('users',{email:'client@recovery.example.test',password,passwordConfirm:password,serverRole:''})
 await create('site_role_assignments',{site:site.id,user:user.id,role:'editor'})
 const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')
 const form = new FormData(); form.append('site',site.id); form.append('file',new Blob([bytes],{type:'image/png'}),'recovery.png')
 const uploadResponse = await fetch(origin+'/api/collections/site_uploads/records',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form})
 assert.ok(uploadResponse.ok,'Generated PNG upload failed'); const upload = await uploadResponse.json()
 await exec(process.execPath,[path.resolve('node_modules/primo-cli/dist/bootstrap.js'),'publish','--server',origin,'--site',site.id,'--token',token,'--json'],{cwd:root,env,timeout:60000,maxBuffer:4*1024*1024})
 const publicHtml = await fetch(origin).then(response=>response.text()); assert.match(publicHtml,/Before upgrade/); assert.match(publicHtml,/Nested recovery value/)
 const tables = ['sites','page_types','pages','site_symbols','site_symbol_fields','page_sections','page_section_entries','site_uploads','site_role_assignments','site_publications']
 // Publication internals deliberately have no ordinary-user list rule.
 // Use the generated local superuser only for the recovery inventory.
 const inventory = async () => Object.fromEntries(await Promise.all(tables.map(async name => [name,(await api(`/api/collections/${name}/records?perPage=200&sort=id`,undefined,'GET',superToken)).items])))
 const original = await inventory()
 const verify = async () => {
  assert.deepEqual(await inventory(),original)
  const auth = await api('/api/collections/users/auth-with-password',{identity:user.email,password},'POST',null)
  assert.equal(auth.record.id,user.id); assert.equal(auth.record.serverRole,'')
  const denied = await fetch(origin+`/api/collections/site_symbols/records/${block.id}`,{method:'PATCH',headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/json'},body:JSON.stringify({html:'changed'})})
  assert.equal(denied.status,403)
  assert.equal(await fetch(origin).then(response=>response.text()),publicHtml)
  const image = await fetch(origin+'/_uploads/'+encodeURIComponent(upload.file)); assert.equal(image.status,200);assert.equal(hash(Buffer.from(await image.arrayBuffer())),hash(bytes))
 }
 await verify(); await stop()
 const backup = path.join(root,'pristine-backup'); await fs.cp(data,backup,{recursive:true})
 const treeHash = async dir => { const h=createHash('sha256'); for(const file of (await fs.readdir(dir,{recursive:true})).sort()){const full=path.join(dir,file);if((await fs.stat(full)).isFile()){h.update(file);h.update(await fs.readFile(full))}} return h.digest('hex') }
 const backupHash = await treeHash(backup)
 data=path.join(root,'upgraded-copy'); await fs.cp(backup,data,{recursive:true});activeBinary=candidate;version='v3.3.2';await start();await verify()
 assert.equal((await fetch(origin)).headers.get('content-security-policy'),"frame-ancestors 'self'")
 await api(`/api/collections/page_section_entries/records/${entry.id}`,{value:'Post-backup candidate write'},'PATCH');await stop()
 data=path.join(root,'restored-copy');await fs.cp(backup,data,{recursive:true});activeBinary=previous;version='v3.3.2-rc.7';await start();await verify();await stop()
 assert.equal(await treeHash(backup),backupHash,'Pristine backup changed')
 data=path.join(root,'upgraded-copy');activeBinary=candidate;version='v3.3.2';await start()
 assert.equal((await api(`/api/collections/page_section_entries/records/${entry.id}`)).value,'Post-backup candidate write')
 await stop();assert.equal(await treeHash(backup),backupHash)
 const result={status:'PASS_SYNTHETIC_PRODUCTION_RECOVERY',previous:'v3.3.2-rc.7',candidate:'v3.3.2',productionValidation:true,tablesCompared:tables.length,allRecordIdsAndValuesRetained:true,nestedValueRetained:true,imageBytesRetained:true,activePublicationRetained:true,clientAuthAndSourceDenialRetained:true,pristineBackupUnchanged:true,newerCandidateWritePreservedSeparately:true,olderExecutableNeverUsedOnUpgradedData:true,backupSha256:backupHash,liveEnvironmentChanged:false}
 if(process.env.PRIMO_RECOVERY_RESULT)await fs.writeFile(process.env.PRIMO_RECOVERY_RESULT,JSON.stringify(result,null,2)+'\n')
 console.log(result)
})
