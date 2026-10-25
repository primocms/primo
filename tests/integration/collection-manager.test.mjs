import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {transform} from 'esbuild'

// Use the real commit implementation with a plain Map in place of its reactive
// container. No DOM is needed to exercise SDK requests and failure propagation.
const source=(await fs.readFile(new URL('../../src/lib/pocketbase/CollectionManager.ts',import.meta.url),'utf8'))
 .replace("import { OrderedSvelteMap } from './OrderedSvelteMap'",'const OrderedSvelteMap = Map')
 .replace("import { is_files_mode } from './author_mode'",'const is_files_mode = () => false')
 .replace("'./entry-reordering.js'", JSON.stringify(new URL('../../src/lib/pocketbase/entry-reordering.js',import.meta.url).href))
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
  const manager=createCollectionManager(instance,undefined,options?{request:options}:undefined)
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
 assert.equal(manager.changes.get('test-record').committed,false);assert.equal(manager.has_pending_changes(),true)
 fail=false;manager.changes.set('test-record',{collection:'page_section_entries',operation:'update',committed:false,data:{value:'Recovered'}})
 await manager.commit();assert.equal(manager.records.get('test-record').data.value,'Recovered')
})


test('failed content updates retain the unsaved value and reject until a successful retry',async()=>{
 const failure={status:503};let fail=true
 const manager=createCollectionManager({collection:()=>({update:async(id,data)=>{if(fail)throw failure;return {id,...data}}})},undefined,{retain_failed_change:change=>change.operation==='update'&&change.collection==='page_section_entries'})
 const edit={collection:'page_section_entries',operation:'update',committed:false,data:{value:'Unsaved client draft'}}
 manager.changes.set('entry',edit);assert.equal(manager.has_pending_changes(),true)
 await assert.rejects(manager.commit(),error=>error===failure)
 assert.deepEqual(manager.changes.get('entry'),{...edit,committed:false});assert.equal(manager.has_pending_changes(),true);assert.equal(manager.is_saving(),false)
 fail=false;await manager.commit();assert.equal(manager.records.get('entry').data.value,'Unsaved client draft');assert.equal(manager.has_pending_changes(),false)
})
test('a failing older commit never erases a newer queued edit',async()=>{
 let reject;const waiting=new Promise((resolve,fail)=>{reject=fail});let first=true
 const manager=createCollectionManager({collection:()=>({update:async(id,data)=>{if(first){first=false;await waiting}return {id,...data}}})})
 manager.changes.set('entry',{collection:'page_section_entries',operation:'update',committed:false,data:{value:'Older'}})
 const saving=manager.commit();await new Promise(resolve=>setImmediate(resolve))
 assert.equal(manager.changes.get('entry').committed,true);assert.equal(manager.is_saving(),true);assert.equal(manager.has_pending_changes(),true)
 const newer={collection:'page_section_entries',operation:'update',committed:false,data:{value:'Newer'}};manager.changes.set('entry',newer)
 reject(new Error('First request failed'));await assert.rejects(saving,/First request failed/)
 assert.equal(manager.changes.get('entry'),newer);await manager.commit();assert.equal(manager.records.get('entry').data.value,'Newer');assert.equal(manager.has_pending_changes(),false)
})


test('retrying a partial content batch preserves acknowledged changes and saves the remaining entries',async()=>{
 const calls=[];let fail=true
 const manager=createCollectionManager({collection:()=>({update:async(id,data)=>{calls.push(id);if(id==='b'&&fail)throw {status:503};return {id,...data}}})},undefined,{retain_failed_change:change=>change.operation==='update'})
 for(const id of ['a','b','c'])manager.changes.set(id,{collection:'page_section_entries',operation:'update',committed:false,data:{value:'Client '+id}})
 await assert.rejects(manager.commit());assert.equal(manager.records.get('a').data.value,'Client a');assert.equal(manager.changes.get('b').data.value,'Client b');assert.equal(manager.has_pending_changes(),true)
 fail=false;await manager.commit();assert.deepEqual(calls,['a','b','b','c']);assert.equal(manager.has_pending_changes(),false)
 for(const id of ['a','b','c'])assert.equal(manager.records.get(id).data.value,'Client '+id)
})
