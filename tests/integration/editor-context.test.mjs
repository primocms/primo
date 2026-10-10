import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const iframeHelpersPath = fileURLToPath(new URL('../../src/lib/builder/components/misc.js', import.meta.url))

async function loadIframeHelpers() {
	const source = await readFile(iframeHelpersPath, 'utf8')
	const testableSource = source
		.replace("import { VERSION as SVELTE_VERSION } from 'svelte/compiler'", "const SVELTE_VERSION = 'test'")
		.replace(/import \{ PRIMO_BASELINE_CSS \} from '\$lib\/common\/baseline-css'/, "const PRIMO_BASELINE_CSS = ''")
		.replaceAll('export const ', 'const ')

	return Function(
		`${testableSource}
return { dynamic_iframe_srcdoc, static_iframe_srcdoc, component_iframe_srcdoc }`
	)()
}

function firstInlineScript(srcdoc) {
	const match = srcdoc.match(/<script>([\s\S]*?)<\/script>/)
	assert(match, 'Expected editor iframe srcdoc to include an inline context script.')
	return match[1].trim()
}

function runInBlockWindow(source, window, filename) {
	vm.runInNewContext(source, { window }, { filename })
}

test('component editor iframe exposes documented context to loaded blocks', async () => {
	const { component_iframe_srcdoc } = await loadIframeHelpers()
	const srcdoc = component_iframe_srcdoc({
		head: '',
		foot: '',
		zone: 'body',
		section_id: 'section-1',
		symbol_id: 'block-1'
	})

	const window = {}
	const contextScript = firstInlineScript(srcdoc)
	assert.match(contextScript, /__PRIMO_CONTEXT__/, 'Expected editor iframe to expose the documented Primo context.')

	runInBlockWindow(contextScript, window, 'editor-context.js')
	runInBlockWindow(
		`
		let is_editor = false

		if (typeof window !== 'undefined') {
			is_editor = window.__PRIMO_CONTEXT__?.environment === 'editor'
		}

		window.__loadedBlock = { is_editor }
		`,
		window,
		'loaded-block.js'
	)

	assert.equal(window.__PRIMO_CONTEXT__.environment, 'editor')
	assert.equal(window.__loadedBlock.is_editor, true)
})

async function previewRuntime(kind, { delayImports = false } = {}) {
	const helpers = await loadIframeHelpers()
	const srcdoc = kind === 'component' ? helpers.component_iframe_srcdoc({}) : helpers.dynamic_iframe_srcdoc('', 'test')
	const script = srcdoc.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replaceAll('import(url)', 'loadModule(url)')
	const target = { innerHTML: '' }
	const messages = []
	const pendingImports = []
	const loadModule = (url) => {
		const imported = import(url)
		if (!delayImports) return imported
		// Control completion order while still loading real ESM modules.
		imported.catch(() => {})
		return new Promise((resolve, reject) => {
			pendingImports.push({
				resolve: () => imported.then(resolve, reject),
				reject
			})
		})
	}
	let handler
	let imports = 0
	let revocations = 0
	const window = {
		addEventListener: (_event, callback) => {
			handler = callback
		},
		parent: { postMessage: (message) => messages.push(message) }
	}
	class Channel {
		set onmessage(callback) {
			handler = callback
		}
		postMessage(message) {
			messages.push(message)
		}
	}
	class SourceBlob {
		constructor(parts) {
			this.source = parts.join('')
		}
	}
	const urls = {
		// Node cannot import blob URLs; use unique data URLs for real ESM imports.
		createObjectURL: (blob) => `data:text/javascript;base64,${Buffer.from(blob.source).toString('base64')}#${kind}-${++imports}`,
		revokeObjectURL: () => {
			revocations++
		}
	}
	Function(
		'window',
		'document',
		'BroadcastChannel',
		'Blob',
		'URL',
		'console',
		'setTimeout',
		'loadModule',
		script
	)(window, { body: target, querySelector: () => target }, Channel, SourceBlob, urls, { log() {}, info() {}, warn() {}, error() {} }, () => 0, loadModule)
	return {
		target,
		messages,
		pendingImports,
		get imports() {
			return imports
		},
		get revocations() {
			return revocations
		},
		send: (source, data) => handler({ data: { payload: { [kind === 'component' ? 'js' : 'componentApp']: source, data } } })
	}
}

function blockSource(version) {
	return `
		export default { version: ${JSON.stringify(version)} };
		export function mount(App, { target, props }) {
			target.innerHTML = App.version + ':' + props.text;
			return { target };
		}
		export function unmount(component) { component.target.innerHTML = ''; }
	`
}

for (const kind of ['component', 'dynamic']) {
	test(`${kind} preview keeps the latest code when imports finish in reverse order`, async () => {
		const preview = await previewRuntime(kind, { delayImports: true })
		const older = preview.send(blockSource('v1'), { text: 'old' })
		const newer = preview.send(blockSource('v2'), { text: 'new' })
		await preview.pendingImports[1].resolve()
		await newer
		assert.equal(preview.target.innerHTML, 'v2:new')
		await preview.pendingImports[0].resolve()
		await older
		assert.equal(preview.target.innerHTML, 'v2:new')
		await preview.send(blockSource('v2'), { text: 'latest' })
		assert.equal(preview.target.innerHTML, 'v2:latest')
		assert.equal(preview.imports, 2)
		assert.equal(preview.revocations, 2)
	})

	test(`${kind} preview ignores failures from superseded imports`, async () => {
		const preview = await previewRuntime(kind, { delayImports: true })
		const older = preview.send(blockSource('v1'), { text: 'old' })
		const newer = preview.send(blockSource('v2'), { text: 'new' })
		await preview.pendingImports[1].resolve()
		await newer
		const messagesBefore = preview.messages.length
		preview.pendingImports[0].reject(new Error('superseded import failed'))
		await older
		assert.equal(preview.target.innerHTML, 'v2:new')
		assert.equal(preview.messages.length, messagesBefore)
		await preview.send(blockSource('v2'), { text: 'latest' })
		assert.equal(preview.target.innerHTML, 'v2:latest')
		assert.equal(preview.imports, 2)
	})

	test(`${kind} preview applies data-only updates arriving during an import`, async () => {
		const preview = await previewRuntime(kind, { delayImports: true })
		const initial = preview.send(blockSource('v1'), { text: 'old' })
		const updated = preview.send(undefined, { text: 'latest' })
		await preview.pendingImports[0].resolve()
		await Promise.all([initial, updated])
		assert.equal(preview.target.innerHTML, 'v1:latest')
		assert.equal(preview.imports, 1)
	})

	test(`${kind} preview handles failed imports during data-only updates and recovers`, async () => {
		const preview = await previewRuntime(kind, { delayImports: true })
		const initial = preview.send(blockSource('v1'), { text: 'old' })
		const updated = preview.send(undefined, { text: 'latest' })
		preview.pendingImports[0].reject(new Error('import failed'))
		await assert.doesNotReject(Promise.all([initial, updated]))
		const errors = preview.messages.filter((message) => (kind === 'component' ? message.type === 'component-error' && message.error : message.event === 'SET_ERROR'))
		assert.equal(errors.length, 1)
		assert.match(kind === 'component' ? errors[0].error : errors[0].payload.error, /import failed/)
		assert.equal(preview.revocations, 1)
		const retry = preview.send(blockSource('v1'), { text: 'recovered' })
		await preview.pendingImports[1].resolve()
		await retry
		assert.equal(preview.target.innerHTML, 'v1:recovered')
		assert.equal(preview.imports, 2)
	})

	test(`${kind} preview updates content without reimporting, but loads changed code`, async () => {
		const preview = await previewRuntime(kind)
		await preview.send(blockSource('v1'), { text: 'first' })
		assert.equal(preview.target.innerHTML, 'v1:first')
		await preview.send(blockSource('v1'), { text: 'edited' })
		assert.equal(preview.target.innerHTML, 'v1:edited')
		assert.equal(preview.imports, 1)
		await preview.send(blockSource('v2'), { text: 'edited' })
		assert.equal(preview.target.innerHTML, 'v2:edited')
		assert.equal(preview.imports, 2)
		assert.equal(preview.revocations, 2)
	})

	test(`${kind} preview shares an in-flight import for rapid content updates`, async () => {
		const preview = await previewRuntime(kind)
		await Promise.all([preview.send(blockSource('v1'), { text: 'first' }), preview.send(blockSource('v1'), { text: 'latest' })])
		assert.equal(preview.imports, 1)
		assert.equal(preview.target.innerHTML, 'v1:latest')
	})

	test(`${kind} preview retries failed imports and recovers after code is corrected`, async () => {
		const preview = await previewRuntime(kind)
		const invalid = 'export default {'
		await assert.doesNotReject(preview.send(invalid, { text: 'first' }))
		await assert.doesNotReject(preview.send(invalid, { text: 'retry' }))
		assert.equal(preview.imports, 2)
		assert.equal(preview.revocations, 2)
		const errors = preview.messages.filter((message) => (kind === 'component' ? message.type === 'component-error' && message.error : message.event === 'SET_ERROR'))
		assert.equal(errors.length, 2)
		assert.match(kind === 'component' ? errors[0].error : errors[0].payload.error, /SyntaxError/)
		await preview.send(blockSource('fixed'), { text: 'recovered' })
		assert.equal(preview.target.innerHTML, 'fixed:recovered')
	})
}
