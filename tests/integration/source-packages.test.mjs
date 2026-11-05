import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {fileURLToPath} from 'node:url'
const exec=promisify(execFile)
const script=fileURLToPath(new URL('../../release/ship/prepare-source-packages.py',import.meta.url))

async function fixture(t,{mutate=false}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'primo-pack-source-'));t.after(()=>fs.rm(root,{recursive:true,force:true}))
 const sources={}
 for(const kind of ['mcp','cli']){
  const dir=path.join(root,kind);sources[kind]=dir;await fs.mkdir(dir)
  const pkg={name:`primo-${kind}`,version:'0.0.0-rc.1',scripts:{build:'node build.cjs'},files:['dist'],dependencies:{}}
  const write=(name,value)=>fs.writeFile(path.join(dir,name),value)
  await write('package.json',JSON.stringify(pkg))
  await write('package-lock.json',JSON.stringify({name:pkg.name,version:pkg.version,lockfileVersion:3,requires:true,packages:{'':pkg}}))
  await write('.gitignore','dist/\nnode_modules/\n')
  await write('tracked.txt','committed source')
  await write('build.cjs',`const fs=require('node:fs');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/index.js','fresh build');${mutate?"fs.writeFileSync('tracked.txt','changed by build');":''}`)
  await exec('git',['init','--quiet'],{cwd:dir})
  await exec('git',['add','.'],{cwd:dir})
  await exec('git',['-c','user.name=Package test','-c','user.email=package-test@example.invalid','commit','--quiet','-m','Fixture'],{cwd:dir})
 }
 const output=path.join(root,'output')
 const prepare=()=>exec('python3',[script,'--mcp-source',sources.mcp,'--cli-source',sources.cli,'--output',output],{maxBuffer:2*1024*1024})
 return {root,sources,output,prepare}
}

test('package preparation excludes stale ignored output without modifying source checkouts',async t=>{
 const f=await fixture(t)
 for(const dir of Object.values(f.sources)){await fs.mkdir(path.join(dir,'dist'));await fs.writeFile(path.join(dir,'dist/removed.js'),'stale generated code')}
 await f.prepare()
 const manifest=JSON.parse(await fs.readFile(path.join(f.output,'manifest.json'),'utf8'))
 for(const [kind,item] of Object.entries(manifest.packages)){
  const listing=await exec('tar',['-tzf',path.join(f.output,item.archive)])
  assert.match(listing.stdout,/package\/dist\/index.js/);assert.doesNotMatch(listing.stdout,/removed.js/)
  assert.equal(await fs.readFile(path.join(f.sources[kind],'dist/removed.js'),'utf8'),'stale generated code')
  await assert.rejects(fs.access(path.join(f.sources[kind],'dist/index.js')),{code:'ENOENT'})
 }
})

test('untracked source cannot be attributed to the committed package identity',async t=>{
 const f=await fixture(t);await fs.writeFile(path.join(f.sources.mcp,'untracked.ts'),'uncommitted source')
 await assert.rejects(f.prepare(),error=>/untracked files must be committed/.test(error.stderr))
 await assert.rejects(fs.access(path.join(f.output,'manifest.json')),{code:'ENOENT'})
})

test('a build that changes tracked source cannot produce a qualification manifest',async t=>{
 const f=await fixture(t,{mutate:true})
 await assert.rejects(f.prepare(),error=>/Build changed tracked source/.test(error.stderr))
 assert.equal(await fs.readFile(path.join(f.sources.mcp,'tracked.txt'),'utf8'),'committed source')
 await assert.rejects(fs.access(path.join(f.output,'manifest.json')),{code:'ENOENT'})
})

test('preparation cannot mix new archives with a previous qualification manifest',async t=>{
 const f=await fixture(t)
 await fs.mkdir(f.output);await fs.writeFile(path.join(f.output,'manifest.json'),'previous qualification')
 await assert.rejects(f.prepare(),error=>/Output directory must be empty/.test(error.stderr))
 assert.equal(await fs.readFile(path.join(f.output,'manifest.json'),'utf8'),'previous qualification')
 assert.deepEqual(await fs.readdir(f.output),['manifest.json'])
})
