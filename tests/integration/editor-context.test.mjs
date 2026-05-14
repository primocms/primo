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
		.replace(
			/import \{ PRIMO_BASELINE_CSS \} from '\$lib\/common\/baseline-css'/,
			"const PRIMO_BASELINE_CSS = ''"
		)
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
