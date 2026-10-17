import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {spawn,execFileSync} from 'node:child_process'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {setTimeout as delay} from 'node:timers/promises'
import {candidate,invariant} from '../launch/lib.mjs'

export {fs,path,delay,invariant}
export async function context() {
 const index=process.argv.indexOf('--run-directory')
 invariant(index>=0 && process.argv[index+1] && process.argv.includes('--run'),'Use --run-directory /private/run --run; no implicit execution')
 const run=path.resolve(process.argv[index+1]),state=JSON.parse(await fs.readFile(path.join(run,'state.json'),'utf8'))
 invariant(/^primo-rc7-qa-\d{8}-[a-f0-9]{6}$/.test(state.projectName) && state.environmentName==='disposable-rc7','Only a newly named disposable QA project is accepted')
 const u=new URL(state.cmsOrigin)
 invariant(u.protocol==='https:' && u.hostname.endsWith('.up.railway.app') && !u.username && !u.password && u.origin===state.cmsOrigin,'Use the provider HTTPS origin without credentials')
 const kit=path.resolve(run,'../release-candidates-rc7'),install=path.join(kit,'installs/node22.13.0'),cli=path.join(install,'node_modules/primo-cli/dist/index.js')
 const requireCLI=createRequire(path.join(install,'node_modules/primo-cli/package.json')),mcpEntry=requireCLI.resolve('primo-mcp'),requireMCP=createRequire(mcpEntry)
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
 for(const [key,name] of [['cli','primo-cli'],['mcp','primo-mcp']]) {
  const archive=path.join(kit,'artifacts',candidate[key].archive)
  invariant(hash(await fs.readFile(archive))===candidate[key].sha256,'Candidate archive checksum mismatch')
  const files=execFileSync('tar',['-tzf',archive],{encoding:'utf8',env:{...process.env,LC_ALL:'C'}}).trim().split('\n').filter(f=>!f.endsWith('/'))
  for(const file of files) {
   invariant(file.startsWith('package/'),'Unexpected package member')
   const bytes=execFileSync('tar',['-xOzf',archive,file],{maxBuffer:16*1024*1024,env:{...process.env,LC_ALL:'C'}})
   invariant(hash(await fs.readFile(path.join(install,'node_modules',name,file.slice(8))))===hash(bytes),'Installed candidate file differs from its archive')
  }
 }
 invariant(hash(await fs.readFile(path.join(run,'build-context/primo')))===candidate.cms.sha256,'Uploaded native binary checksum mismatch')
 const credentials=JSON.parse(await fs.readFile(path.join(run,'private/bootstrap.json'),'utf8'))
 const secrets=new Set(Object.values(credentials).filter(x=>typeof x==='string'))
 const evidence={candidate:'v3.3.2-rc.7',projectId:state.projectId,environmentId:state.environmentId,origin:state.cmsOrigin,startedUtc:new Date().toISOString(),checks:[],externalMailDelivery:false,productionChanged:false}
 const save=async(name,value,privateFile=false)=>{
  const file=path.join(run,privateFile?'private':'evidence',name)
  await fs.writeFile(file,JSON.stringify(value,null,2)+'\n',{mode:0o600})
 }
 const redact=text=>{let s=String(text);for(const secret of secrets)if(secret.length>6)s=s.replaceAll(secret,'[REDACTED]');return s.replace(/eyJ[A-Za-z0-9_.-]{30,}/g,'[REDACTED-TOKEN]')}
 const api=async(route,{method='GET',body,token}={})=>{
  invariant(route.startsWith('/') && !route.startsWith('//'),'API path required')
  const target=new URL(route,state.cmsOrigin);invariant(target.origin===state.cmsOrigin,'API escaped staging scope')
  const response=await fetch(target,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)})
  const text=await response.text();let data;try{data=JSON.parse(text)}catch{}
  return {ok:response.ok,status:response.status,headers:response.headers,text,data}
 }
 const ok=async(route,options={})=>{const r=await api(route,options);invariant(r.ok,'Staging API failed: '+(options.method||'GET')+' '+route.split('?')[0]+' HTTP '+r.status);return r.data}
 const login=async(email,password,admin=false)=>{
  await delay(1700)
  const d=await ok('/api/collections/'+(admin?'_superusers':'users')+'/auth-with-password',{method:'POST',body:{identity:email,password}})
  invariant(d.token && d.record,'No test authentication returned');secrets.add(d.token);secrets.add(password);return d
 }
 const command=async(args,{cwd=path.join(run,'workspace'),home=path.join(run,'private/cli-home'),allowFailure=false}={})=>{
  invariant(['init','new','push','pull','publish','status','validate','build','--version'].includes(args[0]),'CLI operation is outside this handoff')
  await fs.mkdir(cwd,{recursive:true});await fs.mkdir(home,{recursive:true,mode:0o700})
  const commandArgs=[...args],tokenIndex=commandArgs.indexOf('--token')
  if(tokenIndex>=0){
   const token=commandArgs[tokenIndex+1];secrets.add(token);commandArgs.splice(tokenIndex,2)
   home=path.join(home,'invocation-'+randomUUID());await fs.mkdir(path.join(home,'.primo'),{recursive:true,mode:0o700})
   await fs.writeFile(path.join(home,'.primo/tokens.json'),JSON.stringify({[state.cmsOrigin]:token}),{mode:0o600})
  }
  const result=await new Promise((resolve,reject)=>{
   const p=spawn(process.execPath,[cli,...commandArgs],{cwd,env:{...process.env,HOME:home,USERPROFILE:home,PRIMO_ENABLE_USAGE_STATS:'false',PRIMO_MCP_LOCAL:mcpEntry,PRIMO_BINARY:path.join(kit,'artifacts/primo_darwin_arm64'),NO_COLOR:'1'},stdio:['ignore','pipe','pipe']})
   let output='';p.stdout.on('data',b=>output+=b);p.stderr.on('data',b=>output+=b)
   const timer=setTimeout(()=>p.kill('SIGTERM'),120000)
   p.on('error',e=>{clearTimeout(timer);reject(e)});p.on('close',code=>{clearTimeout(timer);resolve({code,output})})
  })
  await fs.appendFile(path.join(run,'evidence/cli-redacted.log'),'\n'+args[0]+': '+redact(result.output),{mode:0o600})
  invariant(allowFailure || result.code===0,'Built CLI '+args[0]+' failed; inspect redacted local evidence')
  return result
 }
 const create=(collection,body,token)=>ok('/api/collections/'+collection+'/records',{method:'POST',body,token})
 const patch=(collection,id,body,token)=>ok('/api/collections/'+collection+'/records/'+id,{method:'PATCH',body,token})
 return {run,state,kit,install,cli,requireCLI,requireMCP,mcpEntry,credentials,evidence,secrets,save,redact,api,ok,login,command,create,patch}
}
export async function mcpSession(c) {
 const {Client}=await import(pathToFileURL(c.requireMCP.resolve('@modelcontextprotocol/sdk/client/index.js')))
 const {StdioClientTransport}=await import(pathToFileURL(c.requireMCP.resolve('@modelcontextprotocol/sdk/client/stdio.js')))
 const client=new Client({name:'disposable-hosted-handoff',version:'1.0.0'})
 await client.connect(new StdioClientTransport({command:process.execPath,args:[c.mcpEntry],cwd:path.join(c.run,'workspace'),stderr:'pipe'}))
 invariant(client.getServerVersion().version==='0.1.11-rc.2','Unexpected MCP package')
 return {close:()=>client.close(),call:async(name,args={})=>{
  const r=await client.callTool({name,arguments:args});invariant(!r.isError,'Packaged MCP tool failed: '+name)
  return r.structuredContent ?? JSON.parse(r.content.find(x=>x.type==='text').text)
 }}
}
