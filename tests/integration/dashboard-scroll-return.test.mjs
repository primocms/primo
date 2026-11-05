import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {transform} from 'esbuild'

function setGlobal(t,key,value) {
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,key)
 Object.defineProperty(globalThis,key,{value,writable:true,configurable:true})
 t.after(()=>{if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]})
}
async function fixture(t) {
 const source=await fs.readFile(new URL('../../src/lib/components/dashboard-scroll.ts',import.meta.url),'utf8')
 const prefix=source.slice(0,source.indexOf('function takeReloadSnapshot')).replace(/^import .*\n/gm,'')
 const {code}=await transform(prefix+'\nexport {takeEditorReturnSnapshot};',{loader:'ts',format:'esm'})
 const storage=new Map();setGlobal(t,'sessionStorage',{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)})
 setGlobal(t,'location',{href:'https://cms.test/admin/dashboard/sites'})
 const module=await import('data:text/javascript;base64,'+Buffer.from(code+`\n// ${Math.random()}`).toString('base64'))
 return {storage,take:module.takeEditorReturnSnapshot}
}

test('a group-less Sites return preserves the snapshot until its matching group mounts',async t=>{
 const {storage,take}=await fixture(t),key='primo:sites-editor-return'
 storage.set(key,JSON.stringify({key:'group-two',top:280,url:'https://cms.test/admin/dashboard/sites?group=two'}))
 assert.equal(take('all'),undefined)
 assert.equal(storage.has(key),true)
 globalThis.location.href+='?group=two'
 assert.equal(take('group-two').top,280)
 assert.equal(storage.has(key),false)
 assert.equal(take('group-two').top,280)
 assert.equal(take('group-one'),undefined)
})

test('corrupt or negative editor return positions are ignored',async t=>{
 const {storage,take}=await fixture(t)
 for(const value of ['broken',JSON.stringify({key:'group',top:-1}),JSON.stringify({key:'group',top:'280'})]) {
 storage.set('primo:sites-editor-return',value);assert.equal(take('group'),undefined)
 }
})
