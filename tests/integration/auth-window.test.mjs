import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createAuthWindow,authWindowMs} from '../presence/auth-window.mjs'

test('fixture pacing derives the actual auth rule instead of assuming a fixed delay', () => {
 assert.equal(authWindowMs({enabled:true,rules:[{label:'*:auth',duration:3}]}),3000)
 assert.equal(authWindowMs({enabled:true,rules:[{label:'*:auth',duration:8}]}),8000)
 assert.equal(authWindowMs({enabled:false,rules:[]}),0)
 assert.throws(()=>authWindowMs({enabled:true,rules:[]}),/must declare/)
})
test('only the unexpired portion of the seeded auth window delays browser submission',async()=>{
 let clock=1000;const waits=[]
 const budget=createAuthWindow({windowMs:3000,now:()=>clock,pause:async ms=>{waits.push(ms);clock+=ms}})
 await budget.wait();assert.deepEqual(waits,[])
 budget.mark();clock+=2000
 assert.equal(await budget.wait(),1100);assert.deepEqual(waits,[1100])
 assert.equal(await budget.wait(),0)
})
test('auth traffic during a quiet-period wait extends its deadline without weakening limits',async()=>{
 let clock=0,calls=0;const waits=[]
 const budget=createAuthWindow({windowMs:3000,now:()=>clock,pause:async ms=>{waits.push(ms);clock+=ms;if(++calls===1)budget.mark()}})
 budget.mark();await budget.wait();assert.deepEqual(waits,[3100,3100])
})
