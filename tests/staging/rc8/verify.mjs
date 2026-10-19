import fs from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import path from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const manifest=JSON.parse(await fs.readFile('tests/staging/rc8-packages.json','utf8'))
for(const [key,name] of [['cli','primo-cli'],['mcp','primo-mcp']]){
 const archive=path.resolve('release/vendor',manifest[key].archive)
 assert.equal(createHash('sha256').update(await fs.readFile(archive)).digest('hex'),manifest[key].sha256)
 const files=execFileSync('tar',['-tzf',archive],{encoding:'utf8'}).trim().split('\n').filter(f=>!f.endsWith('/'))
 for(const file of files){assert.ok(file.startsWith('package/'));const original=execFileSync('tar',['-xOzf',archive,file],{maxBuffer:16*1024*1024});assert.deepEqual(await fs.readFile(path.join('node_modules',name,file.slice(8))),original,key+'/'+file)}
 console.log('PASS every installed '+name+' file matches the exact tarball')
}
const fromCLI=createRequire(path.resolve('node_modules/primo-cli/package.json'))
assert.equal(await fs.realpath(path.dirname(path.dirname(fromCLI.resolve('primo-mcp')))),await fs.realpath('node_modules/primo-mcp'))
const provenance=JSON.parse(await fs.readFile('frozen/platform-result.json','utf8'))
assert.ok(process.env.PRIMO_CANDIDATE_SHA, 'Expected source SHA is required')
assert.equal(provenance.sourceCommit,process.env.PRIMO_CANDIDATE_SHA)
assert.equal(provenance.cms,manifest.cms.version)
assert.equal(provenance.sha256,createHash('sha256').update(await fs.readFile(process.env.PRIMO_TEST_CMS_BINARY)).digest('hex'))
const production=JSON.parse(await fs.readFile('frozen/production-result.json','utf8'))
assert.equal(production.devMode,false)
assert.equal(production.actualInstalledCLIPublication,true)
assert.equal(production.sourceCommit,process.env.PRIMO_CANDIDATE_SHA)
assert.equal(production.version,manifest.cms.version)
assert.equal(production.binarySha256,provenance.sha256)
assert.equal(production.contentIdentityRetained,true)
const binary=process.env.PRIMO_TEST_CMS_BINARY
assert.ok(binary)
assert.equal(createHash('sha256').update(await fs.readFile(binary)).digest('hex'),provenance.sha256)
assert.ok(execFileSync(binary,['--version'],{encoding:'utf8'}).includes(manifest.cms.version))
console.log('PASS exact RC.10 native executable hash, source provenance, production checks and version')
