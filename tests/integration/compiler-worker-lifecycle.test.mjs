import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// Exercise the actual processor module with deterministic worker transports.
// Browser regressions separately use the bundled workers and real compiler.
async function processors(failingWorker = '') {
 const source = await readFile(new URL('../../src/lib/compiler/processors.js', import.meta.url), 'utf8')
 const body = source.replace(/^import .*\n/gm, '')
 const mocks = `
 const started = { css: 0, rollup: 0 };
 const posts = { css: 0, rollup: 0 };
 class postCSSWorker { constructor() { started.css++; if (${JSON.stringify(failingWorker)} === 'css') throw new Error('css worker unavailable'); this.kind = 'css'; } }
 class rollupWorker { constructor() { started.rollup++; if (${JSON.stringify(failingWorker)} === 'rollup') throw new Error('rollup worker unavailable'); this.kind = 'rollup'; } }
 class PromiseWorker {
  constructor(worker) { this.worker = worker; }
  async postMessage(value) { const kind = this.worker.kind; posts[kind]++; if (${JSON.stringify(failingWorker)} === 'transient' && kind === 'rollup' && posts.rollup === 1) return {error:'Temporary module download failure'}; return kind === 'css' ? { css: value.css } : { dom: value.component.html }; }
 }
 const _ = { isEmpty: value => !value || Object.keys(value).length === 0 };
 const render = () => { throw new Error('Unexpected SSR in transport test'); };
 export { started, posts };
 `
 return import('data:text/javascript;base64,' + Buffer.from(mocks + body).toString('base64'))
}

test('loading processors on auth/dashboard starts no compiler workers', async () => {
 const module = await processors()
 assert.deepEqual(module.started, { css: 0, rollup: 0 })
})

test('each compiler starts on first use, then reuses its worker and cache', async () => {
 const module = await processors('unused')
 assert.deepEqual(await module.css('h1 { color: red }'), { css: 'h1 { color: red }' })
 assert.deepEqual(module.started, { css: 1, rollup: 0 })
 await module.css('h1 { color: red }')
 await module.css('h1 { color: blue }')
 assert.equal(module.posts.css, 2)
 const options = { component: { html: '<h1>First</h1>' }, buildStatic: false }
 assert.deepEqual(await module.html(options), { js: '<h1>First</h1>' })
 await module.html(options)
 assert.deepEqual(await module.html({ ...options, component: { html: '<h1>Second</h1>' } }), { js: '<h1>Second</h1>' })
 assert.deepEqual(module.started, { css: 1, rollup: 1 })
 assert.equal(module.posts.rollup, 2)
})

test('a worker startup failure is a compile error and does not prevent the other compiler', async () => {
 const module = await processors('rollup')
 assert.deepEqual(module.started, { css: 0, rollup: 0 })
 const result = await module.html({ component: { html: '<h1>Heading</h1>' }, buildStatic: false })
 assert.equal(result.error, 'rollup worker unavailable')
 assert.deepEqual(await module.css('h1 {}'), { css: 'h1 {}' })
})

test('a temporary compiler failure is reported but cannot poison later retries with identical input', async()=>{
 const module=await processors('transient'),options={component:{html:'<h1>Retained content</h1>'},buildStatic:false}
 assert.equal((await module.html(options)).error,'Temporary module download failure')
 assert.deepEqual(await module.html(options),{js:'<h1>Retained content</h1>'})
 assert.equal(module.posts.rollup,2)
 await module.html(options);assert.equal(module.posts.rollup,2,'Successful retries still populate the preview cache')
})
