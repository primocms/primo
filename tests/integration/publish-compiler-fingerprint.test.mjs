import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

// Execute the build configuration's actual fingerprint calculation with
// controlled file contents, without starting Vite or mutating source files.
const config = await readFile(new URL('../../app.config.js', import.meta.url), 'utf8')
const calculation = config.slice(config.indexOf('function compilerFiles'), config.indexOf('export default'))
const calculate = Function('createHash', 'readFileSync', 'readdirSync', 'rootURL',
	calculation.replaceAll('import.meta.url', 'rootURL') + '\nreturn publishCompilerHash.digest("hex")')

for (const file of ['src/lib/builder/component.js', 'src/lib/builder/utils.ts']) {
	test(`publication cache expires when ${file} changes without authored content changing`, () => {
		const version = (source) => calculate(createHash,
			(url) => url.pathname.endsWith(`/${file}`) ? source : 'unchanged input',
			() => [], 'file:///fixture/app.config.js')
		assert.equal(version('old processor'), version('old processor'))
		assert.notEqual(version('old processor'), version('corrected processor'))
	})
}
