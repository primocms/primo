import assert from 'node:assert/strict'
import { File } from 'node:buffer'
import { createHash, webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'
import { script_version, symbol_script_url } from '../../src/lib/workers/publish-assets.js'

async function publisher({ failUpload = false, failCompile = false, tracked = false } = {}) {
	// Erase TypeScript and supply the worker's stores/runes as a loaded snapshot.
	// Execute the real publication callback and page generator with controlled
	// compiler/upload completion so regressions in their ordering are observable.
	const source = await readFile(new URL('../../src/lib/workers/Publish.svelte.ts', import.meta.url), 'utf8')
	const compiled = ts
		.transpileModule(source.replace(/^import .*$/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
		.outputText.replace('export const usePublishSite', 'const usePublishSite')
	const page = { id: 'home', name: 'Home', parent: '', page_type: 'default' }
	const symbol = { id: 'hero', html: '<h1>{headline}</h1>', js: 'let { headline } = $props()', css: 'h1 { color: red }', fields: () => [{ key: 'headline' }] }
	const section = { id: 'section', page: 'home', symbol: 'hero' }
	const site = { id: 'site', pages: () => [page], page_types: () => [{ id: 'default' }] }
	const uploads = []
	const events = []
	let release
	const gate = new Promise((resolve) => {
		release = resolve
	})
	const processors = {
		css: async (css) => ({ css }),
		html: async (input) => {
			if (input.buildStatic === false) {
				events.push('compile-script')
				await gate
				return failCompile ? { error: 'bad script' } : { js: 'export const label = "Héro 🦉";' }
			}
			events.push('compile-page')
			return { body: '<h1>Headline</h1>', head: '<style>h1 {color:red}</style>' }
		}
	}
	const scope = {
		$derived: (value) => value,
		PRIMO_BASELINE_CSS: '',
		useSvelteWorker: (_ready, _loaded, work) => ({ status: 'working', run: work }),
		Sites: { one: () => site },
		Pages: { one: () => page },
		usePageData: () => ({ data: { pages: [page], symbols: [symbol], page_sections: [section], page_type_sections: [] } }),
		useContent: () => ({ en: { headline: 'Headline' } }),
		self: {
			commit: async () => {},
			invalidate_lists() {},
			instance: {
				baseURL: 'http://localhost',
				authStore: { token: 'token' },
				collection: (collection) => ({
					update: async (id, fields) => {
						if (collection === 'site_symbols') {
							events.push('upload-script')
							if (failUpload) throw new Error('upload failed')
						}
						for (const [field, file] of Object.entries(fields)) uploads.push({ collection, id, field, text: await file.text() })
					}
				})
			}
		},
		processors,
		script_version: (js) => script_version(js, webcrypto),
		symbol_script_url,
		File,
		fetch: async (url, options) => {
			if (url.pathname.endsWith('/publication/site')) {
				if (!tracked) return new Response(null, { status: 404 })
				if (options.method === 'POST') {
					events.push('start')
					return new Response(JSON.stringify({ attempt_id: 'attempt' }))
				}
				return new Response(JSON.stringify({ draft_revision: 'revision' }))
			}
			events.push(url.pathname.endsWith('/fail') ? 'fail' : 'activate')
			return new Response('{}', { status: 200 })
		},
		console: { log() {}, warn() {}, error() {} }
	}
	const usePublishSite = Function(...Object.keys(scope), compiled + '\nreturn usePublishSite;')(...Object.values(scope))
	return { worker: usePublishSite('site'), release, uploads, events }
}

for (const tracked of [false, true]) {
	test(`editor pages wait for uploaded bundles and import their exact hash (tracked=${tracked})`, async () => {
		const build = await publisher({ tracked })
		const work = build.worker.run()
		await new Promise((resolve) => setImmediate(resolve))
		assert.deepEqual(build.events, tracked ? ['start', 'compile-script'] : ['compile-script'], 'no pages may render before the script version is available')
		build.release()
		await work
		const script = build.uploads.find((upload) => upload.field === 'compiled_js').text
		const hash = createHash('sha256').update(script).digest('hex')
		for (const upload of build.uploads.filter((upload) => upload.field === 'compiled_html')) {
			assert(upload.text.includes(`import('/_symbols/hero.js?v=${hash}')`))
		}
		assert.equal(build.uploads.filter((upload) => upload.field === 'compiled_html').length, 1)
		assert.equal(build.uploads.filter((upload) => upload.field === 'preview').length, 1)
		assert(!build.uploads.find((upload) => upload.field === 'preview').text.includes('import('), 'thumbnail previews intentionally omit hydration')
		assert(build.events.indexOf('upload-script') < build.events.indexOf('compile-page'))
		assert(build.events.indexOf('compile-page') < build.events.indexOf('activate'))
	})
}

for (const failure of ['failCompile', 'failUpload']) {
	test(`editor ${failure} prevents page upload and activation`, async () => {
		const build = await publisher({ [failure]: true, tracked: true })
		const work = build.worker.run()
		build.release()
		await assert.rejects(work, /bad script|upload failed/)
		assert(!build.events.includes('compile-page'))
		assert(!build.events.includes('activate'))
		assert(build.events.includes('fail'), 'failed compilation marks the hosted attempt failed')
	})
}

test('editor bundle versions are deterministic over UTF-8 bytes and reject missing bundles', async () => {
	const js = 'export const label = "Héro 🦉";'
	assert.equal(await script_version(js, webcrypto), createHash('sha256').update(js).digest('hex'))
	assert.notEqual(await script_version(js, webcrypto), await script_version(js + '\n', webcrypto))
	assert.throws(() => symbol_script_url('hero', new Map()), /Missing compiled script/)
})

test('insecure HTTP editors still produce fresh cache keys without SubtleCrypto', async () => {
	const crypto = { getRandomValues: (bytes) => webcrypto.getRandomValues(bytes) }
	const first = await script_version('same bundle', crypto)
	assert.match(first, /^[a-f0-9]{64}$/)
	assert.notEqual(await script_version('same bundle', crypto), first)
})
