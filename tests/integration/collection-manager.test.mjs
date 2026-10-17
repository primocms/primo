import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {transform} from 'esbuild'

// Use the real commit implementation with a plain Map in place of its reactive
// container. No DOM is needed to exercise SDK requests and failure propagation.
const source=(await fs.readFile(new URL('../../src/lib/pocketbase/CollectionManager.ts',import.meta.url),'utf8'))
 .replace("import { OrderedSvelteMap } from './OrderedSvelteMap'",'const OrderedSvelteMap = Map')
 .replace("import { is_files_mode } from './author_mode'",'const is_files_mode = () => false')
const {code}=await transform(source,{loader:'ts',format:'esm'})
const {createCollectionManager}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))

test('only opted-in presence writes keep running through document navigation',async()=>{
 for(const options of [undefined,{keepalive:true}]){
  const calls=[]
  const instance={collection:name=>({
   create:async(data,request)=>{calls.push(['create',name,request]);return data},
   update:async(id,data,request)=>{calls.push(['update',name,request]);return {id,...data}},
   delete:async(id,request)=>{calls.push(['delete',name,request])}
  })}
  const manager=createCollectionManager(instance,undefined,options)
  for(const operation of ['create','update','delete']){
   manager.changes.set('test-record',{collection:options?'user_activities':'page_section_entries',operation,committed:false,data:{value:'Saved content'}})
   await manager.commit()
  }
  assert.deepEqual(calls.map(call=>call[0]),['create','update','delete'])
  assert.ok(calls.every(call=>call[2]===options),'Normal content writes must not acquire presence request options')
 }
})

test('presence keepalive does not swallow content commit failures or stop later commits',async()=>{
 const failure={status:503};let fail=true
 const manager=createCollectionManager({collection:()=>({update:async()=>{if(fail)throw failure;return {id:'test-record',value:'Recovered'}}})})
 manager.changes.set('test-record',{collection:'page_section_entries',operation:'update',committed:false,data:{value:'Unsaved'}})
 await assert.rejects(manager.commit(),error=>error===failure)
 assert.equal(manager.changes.has('test-record'),false)
 fail=false;manager.changes.set('test-record',{collection:'page_section_entries',operation:'update',committed:false,data:{value:'Recovered'}})
 await manager.commit();assert.equal(manager.records.get('test-record').data.value,'Recovered')
})
