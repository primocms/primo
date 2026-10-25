import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import ts from 'typescript'
const source=await readFile(new URL('../../src/hooks.client.ts',import.meta.url),'utf8')
const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}})
function fixture({initialized=Promise.resolve(),enabled=false,dev=false,throwTracking=false}={}){
 const observed={tracked:[],logged:[]},mocks={'$lib/PostHog':{initialized},'$lib/instance':{instance:{telemetry_enabled:enabled,dev_mode:dev}},'$lib/analytics':{track_uncaught_error(error){observed.tracked.push(error);if(throwTracking)throw Error('Tracking failed')}}},exports={}
 Function('require','exports','console',outputText)(id=>{assert.ok(mocks[id],id);return mocks[id]},exports,{error(...args){observed.logged.push(args)}})
 return{hook:exports.handleError,observed}
}
const input={error:Error('Private URL and content must not become the error-page message'),kind:'unknown'}
const settle=()=>new Promise(resolve=>setImmediate(resolve))
test('the client error body is available even while telemetry never initializes',()=>{
 const f=fixture({initialized:new Promise(()=>{}),enabled:true}),result=f.hook(input)??{message:'Internal Error'}
 assert.deepEqual(result,{message:'Internal Error'});assert.equal(f.observed.tracked.length,0)
})
test('404 and disabled or development telemetry preserve the safe error body',async()=>{
 for(const options of [{},{enabled:true,dev:true},{enabled:true}]){
  const f=fixture(options),event={kind:'framework',error:{status:404,message:'Not Found'}}
  assert.deepEqual(await(f.hook(event)??{message:event.error.message}),{message:'Not Found'});await settle();assert.deepEqual(f.observed.tracked,[])
 }
 const f=fixture();assert.deepEqual(await(f.hook(input)??{message:'Internal Error'}),{message:'Internal Error'});await settle();assert.deepEqual(f.observed.tracked,[])
})
test('client error telemetry failures cannot delay or reject error rendering',async()=>{
 for(const options of [{initialized:Promise.reject(Error('Unavailable telemetry')),enabled:true},{enabled:true,throwTracking:true}]){
  const f=fixture(options);assert.deepEqual(f.hook(input),{message:'Internal Error'});await settle()
 }
})
test('enabled telemetry still receives the original error while the page receives only the framework message',async()=>{
 const f=fixture({enabled:true});assert.deepEqual(f.hook(input),{message:'Internal Error'});await settle();assert.deepEqual(f.observed.tracked,[input.error]);assert.equal(f.observed.logged.length,1)
})
