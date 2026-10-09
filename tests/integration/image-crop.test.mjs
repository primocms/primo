import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../../src/lib/builder/field-types/image-crop.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } })
const module = { exports: {} }
Function('exports', 'module', outputText)(module.exports, module)
const { measure_image_crop } = module.exports

function image({ width = 704, height = 300, fit = 'cover', padding = 0, connected = true } = {}) {
	return {
		isConnected: connected,
		clientWidth: width,
		clientHeight: height,
		// The editor can scale an iframe. Its transformed outer bounds must not
		// change the component's crop or its responsive breakpoints.
		getBoundingClientRect: () => ({ width: width / 2, height: height / 2 }),
		ownerDocument: {
			defaultView: { getComputedStyle: () => ({ objectFit: fit, paddingLeft: `${padding}px`, paddingRight: `${padding}px`, paddingTop: `${padding}px`, paddingBottom: `${padding}px` }) }
		}
	}
}

test('crop measurement uses the image content box independently of editor scaling', () => {
	assert.deepEqual(measure_image_crop(image()), { width: 704, height: 300, fit: 'cover' })
	assert.deepEqual(measure_image_crop(image({ padding: 8 })), { width: 688, height: 284, fit: 'cover' })
	for (const fit of ['contain', 'fill']) assert.equal(measure_image_crop(image({ fit })).fit, fit)
})

test('unrendered and unsupported crops are unavailable instead of fabricated', () => {
	for (const unavailable of [undefined, null, image({ connected: false }), image({ width: 0 }), image({ height: 0 }), image({ fit: 'none' }), image({ fit: 'scale-down' })]) {
		assert.equal(measure_image_crop(unavailable), null)
	}
})
