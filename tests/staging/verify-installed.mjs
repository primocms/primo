import fs from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import path from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const manifest=JSON.parse(await fs.readFile('tests/staging/rc5-packages.json','utf8'))
for(const [key,name] of [['cli','primo-cli'],['mcp','primo-mcp']]){
 const archive=path.resolve('release/vendor',manifest[key].archive)
 assert.equal(createHash('sha256').update(await fs.readFile(archive)).digest('hex'),manifest[key].sha256)
 const files=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n').filter(f=>!f.endsWith('/'))
 for(const file of files){assert.ok(file.startsWith('package/'));const original=execFileSync('tar',['-xOzf',archive,file],{maxBuffer:16*1024*1024});assert.deepEqual(await fs.readFile(path.join('node_modules',name,file.slice(8))),original,key+'/'+file)}
 console.log('PASS every installed '+name+' file matches the exact tarball')
}
const binary=process.env.PRIMO_TEST_CMS_BINARY
assert.ok(binary)
assert.equal(createHash('sha256').update(await fs.readFile(binary)).digest('hex'),manifest.cms.sha256)
assert.ok(execFileSync(binary,['--version'],{encoding:'utf8'}).includes(manifest.cms.version))
console.log('PASS exact RC.5 native executable hash and version')
