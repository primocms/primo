import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { compileModule } from 'svelte/compiler'
import ts from 'typescript'

// svelte-check does not report every compiler diagnostic in .svelte.ts helpers.
// Compile every rune module too, so production builds cannot reintroduce them.
test('all Svelte rune modules compile without warnings', async () => {
	const root = new URL('../../src/', import.meta.url)
	const files = (await readdir(root, { recursive: true })).filter((file) => /\.svelte\.[jt]s$/.test(file))
	assert.ok(files.length > 0)
	for (const file of files) {
		let source = await readFile(new URL(file, root), 'utf8')
		if (file.endsWith('.ts')) source = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
		const result = compileModule(source, { filename: file, generate: 'client', dev: true })
		assert.deepEqual(result.warnings, [], file)
	}
})
