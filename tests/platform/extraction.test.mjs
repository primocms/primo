import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
const { default: extract } = await import(process.env.PRIMO_TEST_EXTRACT_BASELINE || new URL('../../node_modules/primo-cli/dist/utils/safe-extract.js', import.meta.url).href)

// A stored ZIP fixture retains hostile names/types that archive writers sanitize.
function zip(entries) {
 const locals=[], central=[]; let offset=0
 for (const {name,body='',mode=0o100644} of entries) {
  const n=Buffer.from(name), b=Buffer.from(body); let crc=0xffffffff
  for(const byte of b){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
  crc=(crc^0xffffffff)>>>0
  const l=Buffer.alloc(30); l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(0x800,6);l.writeUInt32LE(crc,14);l.writeUInt32LE(b.length,18);l.writeUInt32LE(b.length,22);l.writeUInt16LE(n.length,26)
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(0x314,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt32LE(crc,16);c.writeUInt32LE(b.length,20);c.writeUInt32LE(b.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE((mode<<16)>>>0,38);c.writeUInt32LE(offset,42)
  locals.push(l,n,b);central.push(c,n);offset+=l.length+n.length+b.length
 }
 const cd=Buffer.concat(central), end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16)
 return Buffer.concat([...locals,cd,end])
}
async function setup(t, entries) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'primo-zip-security-'));t.after(()=>fs.rm(root,{recursive:true,force:true}))
 const archive=path.join(root,'export.zip'), dir=path.join(root,'output');await fs.mkdir(dir);await fs.writeFile(archive,zip(entries));return {root,archive,dir}
}
test('link then file cannot overwrite a file outside extraction', async t=>{
 const x=await setup(t,[{name:'safe.txt',body:'normal'},{name:'escape',mode:0o120777,body:'../outside.txt'},{name:'escape',body:'attacker overwrite'}])
 const outside=path.join(x.root,'outside.txt');await fs.writeFile(outside,'original')
 try {await assert.rejects(extract(x.archive,{dir:x.dir}),/Unsafe|Duplicate/)}
 finally {console.log('outside sentinel:',await fs.readFile(outside,'utf8'))}
 assert.equal(await fs.readFile(outside,'utf8'),'original');assert.deepEqual(await fs.readdir(x.dir),[])
})
for(const name of ['../outside.txt','/absolute.txt','C:/drive.txt','C:\\drive.txt','a/../escape','a//b','a/./b','a/b:stream','a/trailing.','CON.txt','COM¹.txt','CONIN$','a/question?','a/star*','a/pipe|','a/quote"','a/<name>','a\u0000b']) {
 test(`unsafe archive name is rejected before writes: ${JSON.stringify(name)}`,async t=>{
  const x=await setup(t,[{name:'safe.txt',body:'normal'},{name,body:'unsafe'}]);await assert.rejects(extract(x.archive,{dir:x.dir}));assert.deepEqual(await fs.readdir(x.dir),[])
 })
}
for(const entries of [[{name:'a'},{name:'a'}],[{name:'a'},{name:'A'}],[{name:'a'},{name:'a/child'}],[{name:'pipe',mode:0o010644}],[{name:'folder/',mode:0o100644}]]) {
 test(`unsafe type or conflicting path is rejected: ${JSON.stringify(entries)}`,async t=>{
  const x=await setup(t,entries);await assert.rejects(extract(x.archive,{dir:x.dir}));assert.deepEqual(await fs.readdir(x.dir),[])
 })
}
test('existing symlink parent and existing final files are never overwritten',async t=>{
 const x=await setup(t,[{name:'folder/file',body:'unsafe'}]);const outside=path.join(x.root,'outside');await fs.mkdir(outside)
 await fs.symlink(outside,path.join(x.dir,'folder'),'junction');await assert.rejects(extract(x.archive,{dir:x.dir}));assert.deepEqual(await fs.readdir(outside),[])
 await fs.unlink(path.join(x.dir,'folder'));await fs.mkdir(path.join(x.dir,'folder'));await fs.writeFile(path.join(x.dir,'folder/file'),'kept')
 await assert.rejects(extract(x.archive,{dir:x.dir}));assert.equal(await fs.readFile(path.join(x.dir,'folder/file'),'utf8'),'kept')
})
test('regular nested files, explicit directories, empty files and binary bytes round trip',async t=>{
 const bytes=Buffer.from([0,255,1,0,128]);const x=await setup(t,[{name:'blocks/',mode:0o040755},{name:'blocks/hero.svelte',body:'<h1>Client</h1>'},{name:'uploads/image.bin',body:bytes},{name:'pages/empty.yaml'}])
 await extract(x.archive,{dir:x.dir});assert.equal(await fs.readFile(path.join(x.dir,'blocks/hero.svelte'),'utf8'),'<h1>Client</h1>');assert.deepEqual(await fs.readFile(path.join(x.dir,'uploads/image.bin')),bytes);assert.equal((await fs.stat(path.join(x.dir,'pages/empty.yaml'))).size,0)
 if(process.platform!=='win32'){assert.equal((await fs.stat(path.join(x.dir,'uploads/image.bin'))).mode&0o777,0o666&~process.umask());assert.equal((await fs.stat(path.join(x.dir,'uploads'))).mode&0o777,0o777&~process.umask())}
})
