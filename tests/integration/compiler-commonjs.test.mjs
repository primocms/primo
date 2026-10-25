import {test} from 'node:test'
import assert from 'node:assert/strict'
import commonjs from '../../src/lib/compiler/workers/plugins/commonjs.js'
const load=code=>import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))
test('valid runtime ESM does not depend on the failing Firefox CommonJS regular-expression pre-check',()=>{
 const source='var async_mode_flag=false;function enable(){async_mode_flag=true}export {async_mode_flag,enable};'
 const original=RegExp.prototype.test,failure=Object.assign(new Error('too much recursion'),{name:'InternalError'})
 RegExp.prototype.test=function(value){if(this.source==='\\b(require|module|exports)\\b')throw failure;return Reflect.apply(original,this,[value])}
 try{assert.equal(commonjs.transform(source,'runtime-flags.mjs'),source)}finally{RegExp.prototype.test=original}
})
test('CommonJS detection preserves existing ASCII word boundaries, including Unicode neighbors',()=>{
 const neighbors=['','a','9','_','-',' ','é','🧪','.'],legacy=/\b(require|module|exports)\b/
 for(const word of ['require','module','exports'])for(const before of neighbors)for(const after of neighbors){
  const code=`// ${before}${word}${after}\nconst keep = 1;`,expected=legacy.test(code)
  assert.equal(commonjs.transform(code,'boundary.js')!==code,expected,JSON.stringify({word,before,after}))
 }
})
test('CommonJS literal require, named exports and default exports still execute',async()=>{
 const dependency='data:text/javascript;base64,'+Buffer.from('export default 42;').toString('base64')
 const code=`const answer = require('${dependency}'); exports.answer = answer;`
 const module=await load(commonjs.transform(code,'client.cjs'));assert.equal(module.answer,42);assert.deepEqual(module.default,{answer:42})
})
test('production environment replacement stays literal and applies to every occurrence',async()=>{
 const code='const mode = process.env.NODE_ENV; module.exports = [mode, process.env.NODE_ENV, "processXenvXNODE_ENV"];'
 assert.deepEqual((await load(commonjs.transform(code,'env.cjs'))).default,['production','production','processXenvXNODE_ENV'])
})
test('unsupported dynamic requires remain an explicit error',async()=>{
 await assert.rejects(load(commonjs.transform('const target = "unknown"; module.exports = require(target);','dynamic.cjs')),/Cannot require modules dynamically \(unknown\)/)
})
