import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Exercise the actual content resolver with in-memory collection reads. Network
// loading is represented by the same undefined/null states as CollectionMapping.
export async function loadResolver(collections, context) {
	function evaluate(source, imports = {}) {
		const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } })
		const module = { exports: {} }
		Function(
			'require',
			'exports',
			'module',
			outputText
		)(
			(name) => {
				assert(name in imports, `Unexpected import: ${name}`)
				return imports[name]
			},
			module.exports,
			module
		)
		return module.exports
	}
	const entity = evaluate(await readFile(new URL('../../src/lib/Entity.ts', import.meta.url), 'utf8'), { './pocketbase/collections': collections })
	const utilsSource = await readFile(new URL('../../src/lib/builder/utils.ts', import.meta.url), 'utf8')
	const ast = ts.createSourceFile('utils.ts', utilsSource, ts.ScriptTarget.Latest)
	const emptyValueFunction = ast.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'get_empty_value')
	const utils = evaluate(emptyValueFunction.getText(ast))
	utils.normalize_entry_value = (value) => value
	const content = evaluate(await readFile(new URL('../../src/lib/Content.svelte.ts', import.meta.url), 'utf8'), {
		'./pocketbase/collections': collections,
		'$lib/builder/utils': utils,
		'./pocketbase/managers': {},
		'./pages': { build_live_page_url: (page) => ({ pathname: page.id === 'home' ? '/' : `/${page.slug}` }) },
		'./builder/stores/context': {
			page_context: { getOr: () => context },
			page_type_context: { getOr: (fallback) => fallback },
			site_context: { getOr: (fallback) => fallback }
		},
		'./Entity': entity
	})
	return { ...content, get_empty_value: utils.get_empty_value }
}

