import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../../src/lib/pocketbase/user.ts',import.meta.url),'utf8')
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}})
function fixture(results){
 const observed={calls:0,clears:0,tracked:0,cacheClears:0,waits:[]},store={isValid:true,token:'valid-original',record:{id:'editor'},clear(){observed.clears++;this.token='';this.record=null}}
 const self={instance:{authStore:store,collection:()=>({authRefresh:async()=>{observed.calls++;const result=results.shift();if(typeof result==='function')return result(store);if(result)throw result;return {token:store.token,record:store.record}}})},lists:{clear(){observed.cacheClears++}},records:{clear(){observed.cacheClears++}}}
 const mocks={'$lib/analytics':{track_cms_opened(){observed.tracked++}},'./managers':{self},'./collections':{},'svelte/store':{writable:value=>({value}),readonly:value=>value}}
 const exports={};Function('require','exports','setTimeout',outputText)(id=>{assert.ok(mocks[id],id);return mocks[id]},exports,(fn,ms)=>{observed.waits.push(ms);queueMicrotask(fn);return 0})
 return {observed,store,check:exports.check_session}
}
test('a transient refresh retries once without discarding the valid editor session',async()=>{
 for(const error of [{status:0,isAbort:true},{status:0,isAbort:false},{status:503},{status:429}]){
  const f=fixture([error,null]);assert.equal(await f.check(),true);assert.equal(f.observed.calls,2);assert.equal(f.observed.clears,0);assert.equal(f.store.token,'valid-original');assert.equal(f.observed.tracked,1);assert.equal(f.observed.cacheClears,2)
 }
})
test('exhausted transport failures remain unverified and preserve credentials and caches for later recovery',async()=>{
 const f=fixture([{status:0},{status:0}]);assert.equal(await f.check(),false);assert.equal(f.observed.calls,2);assert.equal(f.observed.clears,0);assert.equal(f.observed.tracked,0);assert.equal(f.observed.cacheClears,0);assert.equal(f.store.token,'valid-original')
})
test('a definitive rejected session still signs out without retrying',async()=>{
 for(const status of [400,401,403]){const f=fixture([{status}]);assert.equal(await f.check(),false);assert.equal(f.observed.calls,1);assert.equal(f.observed.clears,1);assert.equal(f.observed.tracked,0);assert.equal(f.observed.cacheClears,0)}
})
test('a stale refresh failure cannot clear a newer signed-in session',async()=>{
 const f=fixture([store=>{store.token='new-session';store.record={id:'new-editor'};throw {status:401}}]);assert.equal(await f.check(),false);assert.equal(f.observed.clears,0);assert.equal(f.store.token,'new-session');assert.equal(f.store.record.id,'new-editor')
})
test('an unknown verification failure cannot grant access or erase the saved session',async()=>{
 for(const error of [new Error('Unexpected verification failure'),{status:404}]){const f=fixture([error]);assert.equal(await f.check(),false);assert.equal(f.observed.calls,1);assert.equal(f.observed.clears,0);assert.equal(f.observed.tracked,0)}
})
