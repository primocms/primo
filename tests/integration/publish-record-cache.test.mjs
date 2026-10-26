import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'
import { z } from 'zod'
import { createCacheLoads } from '../../src/lib/pocketbase/cache_load.js'
import { createEntryReordering } from '../../src/lib/pocketbase/entry-reordering.js'

async function loadFactory(file, exportedName, scope) {
	const source = await readFile(new URL(`../../src/lib/pocketbase/${file}`, import.meta.url), 'utf8')
	const output = ts.transpileModule(source.replace(/^import .*$/gm, ''), {
		compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
	}).outputText.replaceAll('export const ', 'const ')
	return Function(...Object.keys(scope), output + `\nreturn ${exportedName};`)(...Object.values(scope))
}

test('publish responses refresh committed record overlays without realtime; pending edits win', async () => {
	const createManager = await loadFactory('CollectionManager.ts', 'createCollectionManager', { OrderedSvelteMap: Map, is_files_mode: () => false, createEntryReordering })
	const createMapping = await loadFactory('CollectionMapping.svelte.ts', 'createCollectionMapping', { customAlphabet: () => () => 'generated', untrack: fn => fn(), createCacheLoads })
	const manager = createManager()
	const schema = z.object({ id: z.string(), name: z.string(), compiled_html: z.string(), compiled_html_hash: z.string() })
	const pages = createMapping('pages', schema, manager)
	const old = { id: 'page', name: 'Home', compiled_html: 'old.html', compiled_html_hash: 'old' }
	manager.records.set(old.id, { data: old })
	manager.changes.set(old.id, { collection: 'pages', operation: 'update', committed: true, data: { ...old } })
	manager.update_record(old.id, { compiled_html: 'new.html', compiled_html_hash: 'new' })
	assert.equal(pages.one(old.id).compiled_html, 'new.html')
	assert.equal(pages.one(old.id).compiled_html_hash, 'new')
	manager.changes.set(old.id, { collection: 'pages', operation: 'update', committed: false, data: { name: 'Unsaved name' } })
	manager.update_record(old.id, { name: 'Server name', compiled_html: 'next.html' })
	assert.equal(pages.one(old.id).name, 'Unsaved name')
	assert.equal(pages.one(old.id).compiled_html, 'next.html')
})
