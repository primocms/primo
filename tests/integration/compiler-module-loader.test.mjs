import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createModuleLoader} from '../../src/lib/compiler/workers/module_loader.js'
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
const text=value=>({ok:true,text:async()=>value})
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve()}
function fixture(fetchModule){const timers=new Map();let id=0;const load=createModuleLoader({fetchModule,setTimer:(fn,ms)=>{const key=++id;timers.set(key,{fn,ms});return key},clearTimer:key=>timers.delete(key)});return {load,timers,fire(){const [key,t]=timers.entries().next().value;timers.delete(key);t.fn()}}}
test('concurrent compiler jobs share a download and reuse only its completed code',async()=>{
 const pending=deferred();let calls=0;const f=fixture(async()=>{calls++;return pending.promise})
 const first=f.load('module'),second=f.load('module');await flush();assert.equal(calls,1);assert.equal(first,second)
 pending.resolve(text('export const current=1'));assert.deepEqual(await Promise.all([first,second]),['export const current=1','export const current=1'])
 assert.equal(await f.load('module'),'export const current=1');assert.equal(calls,1);assert.equal(f.timers.size,0)
})
test('a hung module header request aborts and retries once; its late result cannot replace the winner',async()=>{
 const slow=deferred();let calls=0,signal;const f=fixture(async(_,options)=>{if(++calls===1){signal=options.signal;return slow.promise}return text('current')})
 const first=f.load('module'),second=f.load('module');await flush();assert.equal([...f.timers.values()][0].ms,10000);f.fire();await flush()
 assert.equal(signal.aborted,true);assert.equal(calls,2);assert.deepEqual(await Promise.all([first,second]),['current','current'])
 slow.resolve(text('stale'));await flush();assert.equal(await f.load('module'),'current');assert.equal(calls,2);assert.equal(f.timers.size,0)
})
test('a hung module response body uses the same deadline and recovers',async()=>{
 const slow=deferred();let calls=0,signal;const f=fixture(async(_,options)=>{signal=options.signal;return ++calls===1?{ok:true,text:()=>slow.promise}:text('body recovered')})
 const result=f.load('module');await flush();const firstSignal=signal;f.fire();assert.equal(firstSignal.aborted,true)
 assert.equal(await result,'body recovered');assert.equal(calls,2);assert.equal(f.timers.size,0);slow.resolve('stale body')
})
test('bounded transient failures evict the rejected flight and a later compilation can recover',async()=>{
 let calls=0;const failure=new TypeError('Temporary network failure'),f=fixture(async()=>{if(++calls<=2)throw failure;return text('recovered')})
 await assert.rejects(f.load('module'),failure);assert.equal(calls,2);assert.equal(f.timers.size,0)
 assert.equal(await f.load('module'),'recovered');assert.equal(calls,3)
})
test('a permanent module error is reported without a redundant retry or poisoned cache',async()=>{
 let calls=0;const f=fixture(async()=>++calls===1?{ok:false,status:404,statusText:'Not Found'}:text('corrected'))
 await assert.rejects(f.load('module'),/404 Not Found/);assert.equal(calls,1);assert.equal(f.timers.size,0)
 assert.equal(await f.load('module'),'corrected');assert.equal(calls,2)
})
