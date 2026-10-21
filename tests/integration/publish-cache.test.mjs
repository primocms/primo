import assert from 'node:assert/strict'
import { File } from 'node:buffer'
import { createHash, webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'
import { script_version, symbol_script_url } from '../../src/lib/workers/publish-assets.js'
import { input_fingerprint, page_file_name, script_file_name, page_file_matches, cached_script_version } from '../../src/lib/workers/publish-cache.js'

async function publisher({ failUpload = false, failCompile = false, failCollection, tracked = false, snapshot, headline = 'Headline' } = {}) {
	// Erase TypeScript and supply the worker's stores/runes as a loaded snapshot.
	// Execute the real publication callback and page generator with controlled
	// compiler/upload completion so regressions in their ordering are observable.
	const source = await readFile(new URL('../../src/lib/workers/Publish.svelte.ts', import.meta.url), 'utf8')
	const compiled = ts
		.transpileModule(source.replace(/^import .*$/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } })
		.outputText.replace('export const usePublishSite', 'const usePublishSite')
	if (!snapshot) {
		const page = { id: 'home', name: 'Home', parent: '', page_type: 'default', compiled_html_hash: '' }
		const symbol = { id: 'hero', html: '<h1>{headline}</h1>', js: 'let { headline } = $props()', css: 'h1 { color: red }', fields: () => [{ key: 'headline' }], compiled_js_hash: '' }
		snapshot = { pages: [page], symbols: [symbol], sections: [{ id: 'section', page: 'home', symbol: 'hero' }], layout: [], types: [{ id: 'default' }], site: { id: 'site' } }
	}
	const site = { ...snapshot.site, pages: () => snapshot.pages, page_types: () => snapshot.types }
	const record = (collection, id) => collection === 'sites' ? snapshot.site : (collection === 'pages' ? snapshot.pages : snapshot.symbols).find(record => record.id === id)
	const uploads = []
	const events = []
	let scriptStarted
	const started = new Promise(resolve => { scriptStarted = resolve })
	let release
	const gate = new Promise((resolve) => {
		release = resolve
	})
	const processors = {
		css: async (css) => ({ css }),
		html: async (input) => {
			if (input.buildStatic === false) {
				events.push('compile-script')
				scriptStarted()
				await gate
				const { html, js, css, data } = input.component
				return failCompile ? { error: 'bad script' } : { js: 'export const label = "Héro 🦉";\n//' + JSON.stringify({ html, js, css, keys: Object.keys(data) }) }
			}
			events.push('compile-page')
			return { body: '<h1>Headline</h1>', head: '<style>h1 {color:red}</style>' }
		}
	}
	const scope = {
		$derived: (value) => value,
		PRIMO_BASELINE_CSS: '',
		SVELTE_VERSION: 'test-version',
		__PRIMO_PUBLISH_COMPILER_VERSION__: 'test-build',
		input_fingerprint: (value) => input_fingerprint(value, webcrypto),
		page_file_name, script_file_name, page_file_matches, cached_script_version,
		useSvelteWorker: (_ready, _loaded, work) => ({ status: 'working', run: work }),
		Sites: { one: () => site },
		Pages: { one: (id) => snapshot.pages.find(page => page.id === id) },
		usePageData: () => ({ data: { pages: snapshot.pages, symbols: snapshot.symbols, page_sections: snapshot.sections, page_type_sections: snapshot.layout } }),
		useContent: (entity, options) => snapshot.content?.(entity, options) ?? ({ en: { headline } }),
		self: {
			commit: async () => {},
			invalidate_lists() {},
			update_record: () => {},
			instance: {
				baseURL: 'http://localhost',
				authStore: { token: 'token' },
				collection: (collection) => ({
					update: async (id, fields) => {
						if (collection === failCollection) throw new Error('upload failed')
						if (collection === 'site_symbols') {
							events.push('upload-script')
							if (failUpload) throw new Error('upload failed')
						}
						const target = record(collection, id)
						for (const [field, value] of Object.entries(fields)) {
							if (typeof value === 'string') target[field] = value
							else {
								uploads.push({ collection, id, field, text: await value.text() })
								target[field] = value.name.replace(/(\.[^.]+)$/, '_0000000001$1')
							}
						}
						return { ...target }
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
	return { worker: usePublishSite('site'), release, uploads, events, snapshot, started }
}

for (const tracked of [false, true]) {
	test(`editor pages wait for uploaded bundles and import their exact hash (tracked=${tracked})`, async () => {
		const build = await publisher({ tracked })
		const work = build.worker.run()
		await build.started
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

async function runPublisher(snapshot, options = {}) {
	const build = await publisher({ snapshot, tracked: true, ...options })
	build.release()
	await build.worker.run()
	return build
}

async function multiPageSnapshot() {
	const { snapshot } = await publisher()
	snapshot.pages.push({ ...snapshot.pages[0], id: 'about', name: 'About', slug: 'about', parent: 'home' })
	snapshot.sections.push({ id: 'about-body', page: 'about', symbol: 'hero' })
	snapshot.symbols.push({ id: 'static', html: '<p>Static</p>', js: '', css: 'p {color:green}', fields: () => [] })
	snapshot.sections.push({ id: 'static-body', page: 'home', symbol: 'static' })
	snapshot.values = { section: 'Home headline', 'about-body': 'About headline' }
	snapshot.content = entity => ({ en: snapshot.values[entity.id] ? { headline: snapshot.values[entity.id] } : {} })
	return snapshot
}

const pageUploads = build => build.uploads.filter(upload => upload.field === 'compiled_html').map(upload => upload.id)

test('editor no-op publication reuses persisted pages, scripts and preview after reloading', async () => {
	const snapshot = await multiPageSnapshot()
	const first = await runPublisher(snapshot)
	assert.equal(pageUploads(first).length, 2)
	const next = await runPublisher(snapshot)
	assert.equal(next.uploads.length, 0)
	assert(!next.events.includes('compile-page'))
	assert(!next.events.includes('compile-script'))
	assert(next.events.includes('activate'))
})

test('editor isolated content edits rebuild and upload only their page', async () => {
	const snapshot = await multiPageSnapshot()
	await runPublisher(snapshot)
	snapshot.values['about-body'] = 'Changed about headline'
	const changed = await runPublisher(snapshot)
	assert.deepEqual(pageUploads(changed), ['about'])
	assert(!changed.events.includes('compile-script'))
	assert(!changed.uploads.some(upload => upload.field === 'preview'))
})

test('editor static sources, shared sources, layouts and head/footer changes invalidate dependencies', async () => {
	const snapshot = await multiPageSnapshot()
	await runPublisher(snapshot)
	snapshot.symbols[1].html = '<p>Changed static</p>'
	assert.deepEqual(pageUploads(await runPublisher(snapshot)), ['home'])
	snapshot.symbols[1].css = 'p {color:orange}'
	assert.deepEqual(pageUploads(await runPublisher(snapshot)), ['home'])
	snapshot.symbols[0].css = 'h1 {color:orange}'
	const shared = await runPublisher(snapshot)
	assert.equal(pageUploads(shared).length, 2)
	assert.equal(shared.uploads.filter(upload => upload.field === 'compiled_js').length, 1)
	snapshot.layout.push({ id: 'footer', page_type: 'default', zone: 'footer', symbol: 'static' })
	assert.equal(pageUploads(await runPublisher(snapshot)).length, 2)
	snapshot.types[0].foot = '<p>Template footer</p>'
	assert.equal(pageUploads(await runPublisher(snapshot)).length, 2)
	snapshot.site.head = '<meta name="changed" content="yes">'
	assert.equal(pageUploads(await runPublisher(snapshot)).length, 2)
})

test('editor replaces missing or legacy artifacts even when their old hash is still present', async () => {
	const snapshot = await multiPageSnapshot()
	await runPublisher(snapshot)
	snapshot.pages[1].compiled_html = 'index_0000000001.html'
	snapshot.symbols[0].compiled_js = 'symbol_0000000001.js'
	const changed = await runPublisher(snapshot)
	assert.deepEqual(pageUploads(changed), ['about'])
	assert.equal(changed.uploads.filter(upload => upload.field === 'compiled_js').length, 1)
	snapshot.pages[0].compiled_html = ''
	assert.deepEqual(pageUploads(await runPublisher(snapshot)), ['home'])
})

test('editor retries failed uploads without trusting uncommitted output', async () => {
	const snapshot = await multiPageSnapshot()
	await runPublisher(snapshot)
	const oldHash = snapshot.pages[1].compiled_html_hash
	snapshot.values['about-body'] = 'Retry this edit'
	const failed = await publisher({ snapshot, tracked: true, failCollection: 'pages' })
	failed.release()
	await assert.rejects(failed.worker.run(), /upload failed/)
	assert.equal(snapshot.pages[1].compiled_html_hash, oldHash)
	assert(!failed.events.includes('activate'))
	assert(failed.events.includes('fail'))
	assert.deepEqual(pageUploads(await runPublisher(snapshot)), ['about'])
})

test('editor repairs a missing/stale preview without re-uploading unchanged pages', async () => {
	const snapshot = await multiPageSnapshot()
	await runPublisher(snapshot)
	snapshot.site.preview = ''
	const repaired = await runPublisher(snapshot)
	assert.deepEqual(pageUploads(repaired), [])
	assert.equal(repaired.uploads.filter(upload => upload.field === 'preview').length, 1)
	assert.equal((await runPublisher(snapshot)).uploads.length, 0)
})

test('editor on older schemas falls back to rebuilding without sending unknown fields', async () => {
	const snapshot = await multiPageSnapshot()
	for (const page of snapshot.pages) delete page.compiled_html_hash
	for (const symbol of snapshot.symbols) delete symbol.compiled_js_hash
	await runPublisher(snapshot)
	assert(snapshot.pages.every(page => page.compiled_html_hash === undefined))
	assert.equal(pageUploads(await runPublisher(snapshot)).length, 2)
})

test('inline hydration props escape embedded script tags without changing source content', async () => {
	const headline = '<script>let image = 1;</script><ScRiPt>alert(1)</ScRiPt><!-- café 🦉'
	const build = await publisher({ headline })
	build.release()
	await build.worker.run()
	const html = build.uploads.find((upload) => upload.field === 'compiled_html').text
	assert.equal((html.match(/<script type="module">/g) || []).length, 1)
	assert.equal((html.match(/<\/script>/gi) || []).length, 1)
	const props = html.match(/props: (.*?) \}\);/s)[1]
	assert.equal(props.includes('<'), false)
	assert.equal(JSON.parse(props).headline, headline)
})
