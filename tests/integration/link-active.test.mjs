import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'

// Exercise the actual content resolver with in-memory collection reads. Network
// loading is represented by the same undefined/null states as CollectionMapping.
async function loadResolver(collections, context) {
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
	return { useContent: content.useContent, get_empty_value: utils.get_empty_value }
}

async function fixture() {
	const siteFields = [
		{ id: 'nav', key: 'nav', type: 'repeater', site: 'site' },
		{ id: 'group', key: 'group', type: 'group', parent: 'nav', site: 'site' },
		{ id: 'link', key: 'link', type: 'link', parent: 'group', site: 'site' },
		{ id: 'empty', key: 'empty', type: 'link', site: 'site' },
		{ id: 'null', key: 'null', type: 'link', site: 'site' },
		{ id: 'featured', key: 'featured', type: 'page', site: 'site' },
		{ id: 'listing', key: 'listing', type: 'page-list', config: { page_type: 'default' }, site: 'site' }
	]
	const pageFields = [{ id: 'cta', key: 'cta', type: 'link', page_type: 'default' }]
	const symbolFields = [
		{ id: 'nav-ref', key: 'nav', type: 'site-field', symbol: 'block', config: { field: 'nav' } },
		{ id: 'cta-ref', key: 'cta', type: 'page-field', symbol: 'block', config: { field: 'cta' } }
	]
	const page = (id, slug) => ({ id, slug, site: 'site', page_type: 'default', entries: () => [{ id: `cta-${id}`, field: 'cta', locale: 'en', value: { page: 'home', label: 'Go home' } }] })
	const home = page('home', '')
	const about = page('about', 'about')
	const records = new Map([
		['home', home],
		['about', about],
		['deleted', null]
	])
	const pageType = { id: 'default', head: '', site: 'site', fields: () => pageFields, entries: () => [] }
	const siteEntries = [
		{ id: 'null-value', field: 'null', locale: 'en', value: null },
		{ id: 'featured-value', field: 'featured', locale: 'en', value: 'about' }
	]
	const values = [
		{ page: 'home', label: 'Home', active: true },
		{ page: 'about', label: 'About', active: true },
		{ url: '/about', label: 'URL', active: true },
		{ url: 'https://example.com', label: 'External', active: true },
		{ page: 'deleted', url: '/old', label: 'Deleted', active: true },
		{ page: 'loading', url: '/pending', label: 'Loading', active: true },
		{ url: '', label: 'Empty', active: true }
	]
	values.forEach((value, index) => {
		siteEntries.push(
			{ id: `item-${index}`, field: 'nav', locale: 'en', index, value: null },
			{ id: `group-${index}`, field: 'group', locale: 'en', parent: `item-${index}`, value: null },
			{ id: `link-${index}`, field: 'link', locale: 'en', parent: `group-${index}`, value }
		)
	})
	const site = { id: 'site', host: 'example.com', fields: () => siteFields, entries: () => siteEntries, uploads: () => [] }
	const block = { id: 'block', html: '', site: 'site', fields: () => symbolFields, entries: () => [] }
	const section = { id: 'header', page_type: 'default', symbol: 'block', entries: () => [] }
	const context = { value: null }
	const collections = {
		Sites: { one: () => site },
		Pages: { one: (id) => records.get(id), list: () => [home, about] },
		PageTypes: { one: () => pageType },
		SiteSymbols: { one: () => block },
		SiteFields: { one: (id) => siteFields.find((field) => field.id === id) },
		PageTypeFields: { one: (id) => pageFields.find((field) => field.id === id) },
		LibraryUploads: { list: () => [] }
	}
	return { ...(await loadResolver(collections, context)), context, site, section, block, records, home, about, siteEntries }
}

test('editor navigation follows the page context and an explicit page overrides it', async () => {
	const { useContent, context, site, section, home, about, siteEntries } = await fixture()
	const authored = structuredClone(siteEntries)
	for (const page of [home, about]) {
		context.value = page
		const content = useContent(section, { target: 'cms' }).en
		assert.deepEqual(
			content.nav.filter((item) => item.group.link.active).map((item) => item.group.link.label),
			[page.id === 'home' ? 'Home' : 'About']
		)
		assert.equal(content.cta.active, page.id === 'home')
	}
	context.value = home
	const published = useContent(section, { target: 'live', page: about }).en
	assert.deepEqual(
		published.nav.filter((item) => item.group.link.active).map((item) => item.group.link.label),
		['About']
	)
	assert.equal(published.cta.active, false)
	const referenced = useContent(site, { target: 'live', page: about }).en
	assert.equal(referenced.featured.cta.active, false)
	assert(referenced.listing.every((item) => item.cta.active === false))
	assert.equal(referenced.empty.active, false)
	assert.equal(referenced.null.active, false)
	assert.deepEqual(siteEntries, authored)
})

test('previews without a page and loading or deleted links are inactive', async () => {
	const { useContent, context, site, records, home } = await fixture()
	const preview = useContent(site, { target: 'cms' }).en
	assert(preview.nav.every((item) => item.group.link.active === false))
	assert.equal(preview.featured.cta.active, false)
	assert(preview.listing.every((item) => item.cta.active === false))
	context.value = home
	// A generic live preview must not inherit the editor's current page.
	assert(useContent(site, { target: 'live' }).en.nav.every((item) => item.group.link.active === false))
	context.value = { id: 'loading' }
	let links = useContent(site, { target: 'cms' }).en.nav.map((item) => item.group.link)
	assert.equal(links[5].url, '/pending')
	assert.equal(links[5].active, false)
	records.set('loading', { id: 'loading', slug: 'pending' })
	links = useContent(site, { target: 'cms' }).en.nav.map((item) => item.group.link)
	assert.equal(links[5].active, true)
	assert.equal(links[4].url, '')
	assert.equal(links[4].active, false)
})

test('empty saved link defaults contain only content', async () => {
	const { get_empty_value } = await fixture()
	assert.deepEqual(get_empty_value({ type: 'link' }), { label: '', text: '', url: '' })
})
