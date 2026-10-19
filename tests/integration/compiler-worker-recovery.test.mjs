import test from 'node:test'
import assert from 'node:assert/strict'
import { createCompilerClient } from '../../src/lib/compiler/worker-client.js'
import { readFile } from 'node:fs/promises'

const engineError = { error: 'InternalError: too much recursion', failureKind: 'engine-recursion', errorStack: 'original stack' }
function deferred() {
 let resolve
 const promise = new Promise(r => { resolve = r })
 return { promise, resolve }
}

test('a damaged worker is replaced once, with the original input retained', async () => {
 const workers = [], calls = [], input = { component: { html: '<h1>{title}</h1>', data: { title: 'Retained' } } }
 const compile = createCompilerClient(() => {
  const id = workers.length
  const worker = { terminated: false, terminate() { this.terminated = true }, async postMessage(value) { calls.push(value); return id === 0 ? engineError : {dom:'compiled'} } }
  workers.push(worker); return worker
 })
 assert.equal(workers.length, 0, 'Worker creation remains lazy')
 assert.deepEqual(await compile(input), {dom:'compiled'})
 assert.deepEqual(calls, [input, input])
 assert.deepEqual(workers.map(w => w.terminated), [true, false])
 await compile(input)
 assert.equal(workers.length, 2, 'Healthy worker is reused')
})

test('persistent engine failure is bounded and preserves diagnostics; a later request can recover', async () => {
 let count = 0, calls = 0, terminated = 0
 const compile = createCompilerClient(() => {
  const id = ++count
  return {terminate() { terminated++ }, async postMessage() { calls++; return id <= 2 ? engineError : {dom:'recovered'} }}
 })
 assert.deepEqual(await compile({}), engineError)
 assert.equal(calls, 2)
 assert.equal(terminated, 2)
 assert.deepEqual(await compile({}), {dom:'recovered'})
 assert.equal(count, 3)
})

test('concurrent requests settle without terminating a worker that still has pending replies', async () => {
 const replies = [deferred(), deferred()], workers = []
 let oldPosts = 0
 const compile = createCompilerClient(() => {
  const id = workers.length
  const worker = {terminated:false, terminate() { this.terminated = true }, postMessage(value) { return id === 0 ? replies[oldPosts++].promise : Promise.resolve({dom:value}) }}
  workers.push(worker); return worker
 })
 const a = compile('first'), b = compile('second')
 replies[0].resolve(engineError)
 assert.deepEqual(await a, {dom:'first'})
 assert.equal(workers[0].terminated, false)
 replies[1].resolve(engineError)
 assert.deepEqual(await b, {dom:'second'})
 assert.equal(workers[0].terminated, true)
 assert.equal(workers.length, 2, 'Late old failure cannot retire the replacement worker')
 assert.deepEqual(await compile('third'), {dom:'third'})
 assert.equal(workers.length, 2)
})

test('ordinary syntax and transport errors remain visible without automatic retries', async () => {
 let calls = 0, terminated = 0
 const syntax = {error:'CompileError: Unexpected token <'}
 const compile = createCompilerClient(() => ({terminate() {terminated++}, async postMessage() { calls++; if (calls === 1) return syntax; throw new Error('transport failed') }}))
 assert.deepEqual(await compile({}), syntax)
 await assert.rejects(compile({}), /transport failed/)
 assert.equal(calls, 2)
 assert.equal(terminated, 0)
})

test('the actual Rollup worker classifies only the captured native error and retains its stack', async () => {
 const source = (await readFile(new URL('../../src/lib/compiler/workers/rollup.worker.js', import.meta.url), 'utf8')).replace(/^import .*\n/gm, '')
 const mocks = `
  let failure; const logs = []; const console = {error: (...args) => logs.push(args)};
  const rollup = async () => {throw failure};
  class svelteWorker {} class PromiseWorker {constructor() {}}
  let run; const registerPromiseWorker = callback => {run = callback};
  const commonjs = {}, json = {}, glsl = {}, SVELTE_VERSION = '5', preview_runtime = '';
  const createModuleLoader = () => () => {};
  export async function build(name, message) {
   failure = Object.assign(new Error(message), {name}); logs.length = 0;
   const result = await run({component:{html:'<h1>Valid</h1>',css:'',js:'',data:{}},head:{code:'',data:{}},buildStatic:false});
   return {result, logs};
  }
 `
 const {build} = await import('data:text/javascript;base64,' + Buffer.from(mocks + source).toString('base64'))
 const recovered = await build('InternalError', 'too much recursion')
 assert.equal(recovered.result.failureKind, 'engine-recursion')
 assert.match(recovered.result.errorStack, /InternalError: too much recursion/)
 assert.equal(recovered.logs.length, 0, 'Parent decides whether the bounded recovery failed')
 for (const [name, message] of [['Error','too much recursion'],['InternalError','different failure'],['CompileError','Unexpected token']]) {
  const ordinary = await build(name, message)
  assert.equal(ordinary.result.failureKind, '')
  assert.equal(ordinary.logs.length, 1)
  assert.ok(ordinary.result.error.includes(message))
 }
})
