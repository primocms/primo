import {test} from 'node:test'
import assert from 'node:assert/strict'
const fresh=()=>import(new URL('../../src/lib/builder/component.js?case='+Math.random(),import.meta.url))

test('registered processors return values and propagate sync/async compiler failures', {timeout:1000},async()=>{
 const {processors,registerProcessors}=await fresh(),failure=new Error('Module import failed')
 registerProcessors({html:async raw=>({body:raw}),css:raw=>'compiled '+raw})
 assert.deepEqual(await processors.html('content'),{body:'content'});assert.equal(await processors.css('style'),'compiled style')
 for(const compiler of [()=>{throw failure},async()=>{throw failure}]){
  registerProcessors({html:compiler,css:compiler})
  await assert.rejects(processors.html('content'),error=>error===failure)
  await assert.rejects(processors.css('style'),error=>error===failure)
 }
})
test('concurrent calls made before registration settle independently',async()=>{
 const {processors,registerProcessors}=await fresh()
 const calls=Array.from({length:120},(_,i)=>processors.html('request '+i))
 registerProcessors({html:async raw=>raw})
 assert.deepEqual(await Promise.all(calls),calls.map((_,i)=>'request '+i))
})
test('missing processor registration rejects rather than leaving a permanent spinner',async t=>{
 t.mock.timers.enable({apis:['setTimeout']})
 const {processors}=await fresh()
 const checked=assert.rejects(processors.html('content'),/HTML compiler did not register/)
 for(let n=0;n<100;n++){t.mock.timers.tick(100);await Promise.resolve()}
 await checked
})
