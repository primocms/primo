import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createSiteHeadPreview} from '../../src/lib/builder/site_head.js'
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function fixture(compile){const results=[],errors=[];return {results,errors,head:createSiteHeadPreview({compile,onResult:value=>results.push(value),onError:error=>errors.push(error)})}}
test('site head compiles once per resolved input and source-only head edits still compile',async()=>{
 const calls=[],f=fixture(async input=>{calls.push(input);return input.html})
 await f.head.update({html:'First',data:undefined});assert.equal(calls.length,0)
 await f.head.update({html:'First',data:{title:'Client'}})
 await f.head.update({html:'First',data:{title:'Client'}});assert.equal(calls.length,1)
 await f.head.update({html:'Second',data:{title:'Client'}});assert.equal(calls.length,2)
 assert.deepEqual(f.results,['First','Second']);assert.deepEqual(f.errors,[])
})
test('a live site-head import failure is observed, while leaving cancels failures and late writes',async()=>{
 const failure=Error('Importing a module script failed.'),f=fixture(async()=>{throw failure})
 await f.head.update({html:'Head',data:{}});assert.deepEqual(f.errors,[failure])
 for(const result of ['reject','resolve']){
  const pending=deferred(),g=fixture(()=>pending.promise),settled=g.head.update({html:'Head',data:{}})
  g.head.cancel();pending[result](result==='reject'?failure:'Stale head');await settled
  assert.deepEqual(g.results,[]);assert.deepEqual(g.errors,[])
 }
})
test('newer head data wins over stale completion, and resume can retry the same input',async()=>{
 const older=deferred(),newer=deferred();let calls=0
 const f=fixture(()=>++calls===1?older.promise:newer.promise)
 const first=f.head.update({html:'Head',data:{title:'Old'}}),second=f.head.update({html:'Head',data:{title:'New'}})
 newer.resolve('Current head');await second;older.resolve('Old head');await first
 assert.deepEqual(f.results,['Current head'])
 f.head.cancel();await f.head.update({html:'Head',data:{title:'New'}});assert.equal(calls,3)
 assert.deepEqual(f.results,['Current head','Current head']);assert.deepEqual(f.errors,[])
})
