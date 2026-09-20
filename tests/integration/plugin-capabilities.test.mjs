import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const entry = fileURLToPath(new URL('../../src/lib/common/plugins/index.ts', import.meta.url))

// The contract is TypeScript and this runner is plain ESM, so bundle it the way
// the app does (esbuild, via vite) rather than testing a hand-rewritten copy.
const out_dir = await mkdtemp(join(tmpdir(), 'primo-capabilities-'))
const out_file = join(out_dir, 'plugins.mjs')

await build({ entryPoints: [entry], outfile: out_file, bundle: true, format: 'esm', platform: 'neutral', logLevel: 'silent' })

const { CapabilityError, PluginManifest, authorize_invocation, create_plugin_runtime } = await import(pathToFileURL(out_file).href)

after(() => rm(out_dir, { recursive: true, force: true }))

function manifest(overrides = {}) {
	return PluginManifest.parse({ id: 'forms', name: 'Forms', version: '1.0.0', ...overrides })
}

test('bare capability ids in requires normalise to the long form', () => {
	const parsed = manifest({ requires: ['data', { capability: 'email', reason: 'notify the site owner' }] })

	assert.deepEqual(parsed.requires, [{ capability: 'data' }, { capability: 'email', reason: 'notify the site owner' }])
})

test('declaring collections without the data capability is rejected', () => {
	const result = PluginManifest.safeParse({
		id: 'forms',
		name: 'Forms',
		version: '1.0.0',
		collections: [{ key: 'submissions', fields: [{ key: 'email', type: 'text' }] }]
	})

	assert.equal(result.success, false)
	assert.match(result.error.issues[0].message, /needs the "data" capability/)
})

test('a hook action is rejected unless the capability it reaches is required', () => {
	const result = PluginManifest.safeParse({
		id: 'forms',
		name: 'Forms',
		version: '1.0.0',
		requires: ['hooks'],
		hooks: [{ on: 'form.submitted', action: 'email.send', config: { to: 'owner@example.com' } }]
	})

	assert.equal(result.success, false)
	assert.match(result.error.issues[0].message, /needs the "email" capability/)
})

test('a relation pointing outside the plugin is rejected', () => {
	const result = PluginManifest.safeParse({
		id: 'forms',
		name: 'Forms',
		version: '1.0.0',
		requires: ['data'],
		collections: [{ key: 'submissions', fields: [{ key: 'site', type: 'relation', collection: 'sites' }] }]
	})

	assert.equal(result.success, false)
	assert.match(result.error.issues[0].message, /doesn't declare/)
})

test('a cron binding without a schedule is rejected', () => {
	const result = PluginManifest.safeParse({
		id: 'digest',
		name: 'Digest',
		version: '1.0.0',
		requires: ['hooks'],
		hooks: [{ on: 'cron', action: 'webhook', config: { url: 'https://example.com/hook' } }]
	})

	assert.equal(result.success, false)
})

test('the runtime exposes only the capabilities the manifest requires', () => {
	const parsed = manifest({ requires: ['data'] })
	const primo = create_plugin_runtime(parsed, async () => null)

	assert.deepEqual(Object.keys(primo), ['data'])
	assert.equal(typeof primo.data.insert, 'function')
})

test('reaching an undeclared capability names what to change', () => {
	const parsed = manifest({ requires: ['data'] })
	const primo = create_plugin_runtime(parsed, async () => null)

	assert.throws(
		() => primo.payments,
		(error) => {
			assert.ok(error instanceof CapabilityError)
			assert.equal(error.code, 'not_declared')
			assert.match(error.message, /Add it to requires/)
			return true
		}
	)
})

test('an unknown method on a declared capability lists the real ones', () => {
	const parsed = manifest({ requires: ['data'] })
	const primo = create_plugin_runtime(parsed, async () => null)

	assert.throws(
		() => primo.data.upsert,
		(error) => error.code === 'unknown_method' && /insert, update, delete, get, list/.test(error.message)
	)
})

test('server-only methods are absent from a browser runtime and present on the server', () => {
	const parsed = manifest({ requires: ['payments'] })

	const browser = create_plugin_runtime(parsed, async () => null)
	assert.throws(
		() => browser.payments.refund,
		(error) => error.code === 'server_only'
	)
	assert.equal(typeof browser.payments.create_checkout, 'function')

	const server = create_plugin_runtime(parsed, async () => null, { source: 'server' })
	assert.equal(typeof server.payments.refund, 'function')
})

test('raw() is refused from plugin code on every capability', () => {
	const parsed = manifest({ requires: ['storage'] })

	for (const source of ['browser', 'server']) {
		const primo = create_plugin_runtime(parsed, async () => null, { source })
		assert.throws(
			() => primo.storage.raw,
			(error) => error.code === 'server_only' && /vendor SDK client/.test(error.message)
		)
	}
})

test('a call forwards a complete invocation envelope and nothing else', async () => {
	const parsed = manifest({ requires: ['storage'] })
	const sent = []
	const primo = create_plugin_runtime(parsed, async (invocation) => {
		sent.push(invocation)
		return { path: 'a.txt' }
	})

	const result = await primo.storage.get('a.txt')

	assert.deepEqual(sent, [{ plugin_id: 'forms', capability: 'storage', method: 'get', args: ['a.txt'] }])
	assert.deepEqual(result, { path: 'a.txt' })
})

test('authorize_invocation is enforceable on its own, for the server-side check', () => {
	const parsed = manifest({ requires: ['data'] })

	assert.doesNotThrow(() => authorize_invocation(parsed, { capability: 'data', method: 'list' }, 'server'))
	assert.throws(
		() => authorize_invocation(parsed, { capability: 'ai', method: 'complete' }, 'server'),
		(error) => error.code === 'not_declared'
	)
	assert.throws(
		() => authorize_invocation(parsed, { capability: 'nope', method: 'x' }, 'server'),
		(error) => error.code === 'unknown_capability'
	)
})

// Forms plugin: the shipped manifest.json must satisfy the contract.
test('forms plugin manifest is valid and declares required capabilities', async () => {
	const manifestPath = fileURLToPath(new URL('../../plugins/forms/manifest.json', import.meta.url))
	const raw = JSON.parse(await readFile(manifestPath, 'utf8'))
	const result = PluginManifest.safeParse(raw)
	assert.ok(result.success, result.error?.message)

	const caps = result.data.requires.map((r) => r.capability)
	assert.ok(caps.includes('data'), 'forms must require data')
	assert.ok(caps.includes('email'), 'forms must require email')

	// email is optional (SMTP may be absent)
	const emailReq = result.data.requires.find((r) => r.capability === 'email')
	assert.ok(emailReq.optional, 'email requirement should be optional')
})

test('forms plugin: email.send is server-only — a browser block cannot send mail', () => {
	const parsed = manifest({ requires: ['email'] })
	const browser = create_plugin_runtime(parsed, async () => null, { source: 'browser' })

	// send and send_batch must not be callable from the browser
	assert.throws(
		() => browser.email.send,
		(error) => error.code === 'server_only'
	)

	// but they are available on the server
	const server = create_plugin_runtime(parsed, async () => null, { source: 'server' })
	assert.equal(typeof server.email.send, 'function')
})

test('forms plugin: form.submitted hook with email.send requires both hooks and email', () => {
	// A hypothetical notification hook — only valid when both capabilities are declared.
	const result = PluginManifest.safeParse({
		id: 'forms',
		name: 'Forms',
		version: '1.0.0',
		requires: ['hooks', 'email'],
		hooks: [{ on: 'form.submitted', action: 'email.send', config: { to: 'owner@example.com' } }]
	})
	assert.ok(result.success, result.error?.message)
})

test('forms plugin: form.submitted hook without email capability is rejected', () => {
	const result = PluginManifest.safeParse({
		id: 'forms',
		name: 'Forms',
		version: '1.0.0',
		requires: ['hooks'],
		hooks: [{ on: 'form.submitted', action: 'email.send', config: { to: 'owner@example.com' } }]
	})
	assert.equal(result.success, false)
	assert.match(result.error.issues[0].message, /needs the "email" capability/)
})
