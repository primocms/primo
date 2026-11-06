import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createCacheLoads} from '../../src/lib/pocketbase/cache_load.js'
function fixture(){const timers=new Map();let id=0;const loads=createCacheLoads({setTimer:(callback,delay)=>{const n=++id;timers.set(n,{callback,delay});return n},clearTimer:n=>timers.delete(n)});return {loads,timers,fire(){const [key,timer]=timers.entries().next().value;timers.delete(key);timer.callback()}}}
test('a canceled sole fetch invalidates its loading placeholder for a retry',()=>{
 const f=fixture(),cache=new Map([['user',undefined]])
 f.loads.begin('user').retry(()=>cache.delete('user'))
 assert.equal(cache.has('user'),true);assert.equal([...f.timers.values()][0].delay,250)
 f.fire();assert.equal(cache.has('user'),false)
})
test('an older cancellation or result cannot invalidate or overwrite a newer winning request',()=>{
 const f=fixture(),values=[],old=f.loads.begin('user'),winner=f.loads.begin('user')
 old.retry(()=>assert.fail('Must not evict a newer placeholder'));old.settle(()=>values.push('stale'))
 assert.equal(f.timers.size,0);winner.settle(()=>values.push('current'));old.settle(()=>values.push('stale again'))
 assert.deepEqual(values,['current'])
})
test('a replacement cancels a pending retry and unrelated keys remain independent',()=>{
 const f=fixture(),values=[];f.loads.begin('user').retry(()=>values.push('old retry'))
 const winner=f.loads.begin('user');f.loads.begin('sites').retry(()=>values.push('sites retry'))
 assert.equal(f.timers.size,1);winner.settle(()=>values.push('user result'));f.fire()
 assert.deepEqual(values,['user result','sites retry'])
})
test('offline retries back off, cap their rate and reset after success',()=>{
 const f=fixture(),delays=[]
 for(let i=0;i<7;i++){f.loads.begin('sites').retry(()=>{});delays.push([...f.timers.values()][0].delay);f.fire()}
 assert.deepEqual(delays,[250,500,1000,2000,4000,5000,5000])
 f.loads.begin('sites').settle(()=>{});f.loads.begin('sites').retry(()=>{});assert.equal([...f.timers.values()][0].delay,250)
})

test('an application failure can still settle the owned placeholder into an error state',()=>{
 const f=fixture(),request=f.loads.begin('sites'),values=[]
 assert.throws(()=>request.settle(()=>{throw Error('Malformed response')}),/Malformed response/)
 request.settle(()=>values.push('error state'));request.settle(()=>values.push('stale'))
 assert.deepEqual(values,['error state'])
})
