import {execFileSync} from 'node:child_process'
import assert from 'node:assert/strict'
const frozen='5642f312bd29b83dea7ed3c86c68581ad52c5db3'
assert.equal(process.env.PRIMO_CANDIDATE_SHA,frozen)
const files=execFileSync('git',['diff','--name-only',frozen,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean)
assert.deepEqual(files.filter(file=>!file.startsWith('tests/')&&!file.startsWith('.github/workflows/')),[],'Timing qualification must not change product source or dependency archives')
console.log('PASS product source/dependencies unchanged from sealed RC.11; only test/workflow files differ')
