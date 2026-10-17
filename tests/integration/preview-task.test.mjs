import {test} from 'node:test'
import assert from 'node:assert/strict'
import {startPreviewTask} from '../../src/lib/builder/preview_task.js'

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function fixture(run){const results=[],errors=[];let finished=0;const task=startPreviewTask({run,onResult:result=>results.push(result),onError:error=>errors.push(error),onSettled:()=>finished++});return {task,results,errors,finished:()=>finished}}

test('preview loading lasts until compilation actually settles',async()=>{
 const pending=deferred(),f=fixture(()=>pending.promise)
 assert.equal(f.finished(),0);pending.resolve({body:'Preview'});await f.task.settled
 assert.deepEqual(f.results,[{body:'Preview'}]);assert.deepEqual(f.errors,[]);assert.equal(f.finished(),1)
})
test('asynchronous and synchronous compiler failures are observed and exposed',async()=>{
 const failure=new Error('Module import failed')
 for(const run of [()=>Promise.reject(failure),()=>{throw failure}]){
  const f=fixture(run);await f.task.settled
  assert.deepEqual(f.errors,[failure]);assert.deepEqual(f.results,[]);assert.equal(f.finished(),1)
 }
})
test('disposed and superseded previews cannot apply late results or report teardown errors',async()=>{
 for(const outcome of ['resolve','reject']){
  const pending=deferred(),old=fixture(()=>pending.promise);old.task.cancel()
  const fresh=fixture(async()=>({body:'Current'}));await fresh.task.settled
  pending[outcome](outcome==='resolve'?{body:'Stale'}:new Error('Navigation canceled import'));await old.task.settled
  assert.deepEqual(old.results,[]);assert.deepEqual(old.errors,[]);assert.equal(old.finished(),0);assert.deepEqual(fresh.results,[{body:'Current'}])
 }
})
