import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { transform } from 'esbuild'

// Exercise the actual mapping and load ownership with deterministic effects,
// SDK cancellation and retry timers. The browser regressions cover reactivity.
const source = (await fs.readFile(new URL('../../src/lib/pocketbase/CollectionMapping.svelte.ts', import.meta.url), 'utf8'))
 .replace("import { customAlphabet } from 'nanoid'", 'const customAlphabet = () => () => "created"')
 .replace("import { untrack } from 'svelte'", 'const untrack = callback => callback()')
 .replace("import { observeSubscription } from './subscription.js'", 'const observeSubscription = () => {}')
 .replace("import { createCacheLoads } from './cache_load.js'", `import { createCacheLoads as makeLoads } from ${JSON.stringify(new URL('../../src/lib/pocketbase/cache_load.js', import.meta.url).href)}; const createCacheLoads = () => makeLoads({setTimer: callback => {const id = ++timerId; timers.set(id, callback); return id}, clearTimer: id => timers.delete(id)});`)
const { code } = await transform(source + '\nexport const effects=[]; export const timers=new Map(); let timerId=0; function $effect(callback){effects.push(callback)}', { loader: 'ts', format: 'esm' })
const { createCollectionMapping, effects, timers } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const flush = () => { while (effects.length) effects.shift()() }
const settle = () => new Promise(resolve => setImmediate(resolve))

function fixture() {
 const requests = []
 const sdk = { getFullList() {
  requests.at(-1)?.reject({ isAbort: true })
  return new Promise((resolve, reject) => requests.push({ resolve, reject }))
 } }
 const manager = { instance: { collection: () => sdk }, changes: new Map(), records: new Map(), lists: new Map(), entry_reordering: { indices: new Map() } }
 return { manager, requests }
}

test('a relationship reread after cache clearing cannot let the canceled load evict its replacement', async () => {
 const { manager, requests } = fixture()
 const mapping = createCollectionMapping('blocks', { parse: value => value }, manager)
 const options = { filter: { group: 'beta' } }
 mapping.from(manager).list(options); flush()
 manager.records.clear(); manager.lists.clear()
 mapping.from(manager).list(options); flush()
 assert.equal(requests.length, 2)
 await settle()
 assert.equal(timers.size, 0, 'the canceled older owner must not schedule cache eviction')
 requests[1].resolve([{ id: 'winner', group: 'beta', name: 'Loaded block' }])
 await settle()
 const loaded = mapping.from(manager).list(options); flush()
 assert.deepEqual(loaded.map(record => record.name), ['Loaded block'])
 assert.equal(requests.length, 2)
})

test('scoped mappings retain independent loads and records for different servers', async () => {
 const first = fixture(), second = fixture()
 const mapping = createCollectionMapping('blocks', { parse: value => value }, first.manager)
 mapping.from(first.manager).list(); mapping.from(second.manager).list(); flush()
 first.requests[0].resolve([{ id: 'same-id', name: 'Local' }])
 second.requests[0].resolve([{ id: 'same-id', name: 'Marketplace' }])
 await settle()
 assert.equal(mapping.from(first.manager).list()[0].name, 'Local')
 assert.equal(mapping.from(second.manager).list()[0].name, 'Marketplace')
 flush()
 assert.equal(first.requests.length, 1); assert.equal(second.requests.length, 1)
})
