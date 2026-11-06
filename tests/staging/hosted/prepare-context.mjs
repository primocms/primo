import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {candidate,invariant} from '../launch/lib.mjs'
const args=process.argv.slice(2)
if(args.includes('--help')){console.log('node prepare-context.mjs --native /path/to/primo_linux_amd64 --output /new/context [--run]\nDefault validates only. --run creates a new checksum-verified context; never deploys or rebuilds Primo.');process.exit()}
const value=name=>{const n=args.indexOf(name);invariant(n>=0 && args[n+1],'Required context option missing');return args[n+1]}
const native=path.resolve(value('--native')),output=path.resolve(value('--output'))
invariant(createHash('sha256').update(await fs.readFile(native)).digest('hex')===candidate.cms.sha256,'Native input differs from frozen RC.7 linux_amd64')
invariant(!await fs.access(output).then(()=>true,()=>false),'Context output already exists; refusing to overwrite it')
const templates=['Dockerfile','.dockerignore','.railwayignore','railway.json','native.sha256']
const checksum=await fs.readFile(new URL('./native.sha256',import.meta.url),'utf8')
invariant(checksum.trim()===candidate.cms.sha256+'  primo','Template native checksum differs from candidate manifest')
if(!args.includes('--run')){console.log(JSON.stringify({status:'READY_NOT_WRITTEN',nativeSha256:candidate.cms.sha256,networkRequests:0}));process.exit()}
await fs.mkdir(output,{mode:0o700})
for(const name of templates)await fs.copyFile(new URL('./'+name,import.meta.url),path.join(output,name),1)
await fs.copyFile(native,path.join(output,'primo'),1)
const dockerfile=await fs.readFile(new URL('./Dockerfile',import.meta.url),'utf8')
await fs.writeFile(path.join(output,'rc7-provenance.json'),JSON.stringify({candidate:candidate.cms.version,sourceCommit:candidate.cms.sourceCommit,nativeRunId:candidate.cms.runId,nativeSha256:candidate.cms.sha256,baseImages:dockerfile.split('\n').filter(x=>x.startsWith('FROM ')),builtFromSource:false,disposable:true},null,2)+'\n',{flag:'wx'})
console.log(JSON.stringify({status:'PASS_CONTEXT_ONLY',nativeSha256:candidate.cms.sha256,files:templates.length+2,deployed:false}))
