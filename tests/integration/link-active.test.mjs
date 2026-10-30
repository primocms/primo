import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadResolver } from '../helpers/content-resolver.mjs'

async function fixture(mode = 'id') {
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
	// Root keys deliberately differ from IDs, including nested key collisions.
	for (const field of siteFields) {
		const old = field.id
		field.id = `site-${old}-id`
		for (const entry of siteEntries) if (entry.field === old) entry.field = field.id
		for (const child of siteFields) if (child.parent === old) child.parent = field.id
		for (const reference of symbolFields) if (reference.type === 'site-field' && reference.config.field === old) reference.config.field = mode === 'id' ? field.id : field.key
	}
	const extra = [
		{ id: 'footer-id', key: 'footer_groups', type: 'repeater', site: 'site' },
		{ id: 'footer-title', key: 'title', type: 'text', parent: 'footer-id', site: 'site' },
		{ id: 'footer-links', key: 'links', type: 'repeater', parent: 'footer-id', site: 'site' },
		{ id: 'footer-link', key: 'link', type: 'link', parent: 'footer-links', site: 'site' },
		{ id: 'notice-id', key: 'notice', type: 'text', site: 'site' },
		{ id: 'count-id', key: 'count', type: 'number', site: 'site' },
		{ id: 'enabled-id', key: 'enabled', type: 'switch', site: 'site' },
		{ id: 'empty-id', key: 'empty_list', type: 'repeater', site: 'site' },
		{ id: 'nested-nav', key: 'nav', type: 'text', parent: 'footer-id', site: 'site' }
	]
	siteFields.push(...extra)
	for (const field of extra.filter(field => !field.parent)) symbolFields.push({ id: `ref-${field.id}`, key: field.key, symbol: 'block', type: 'site-field', config: { field: mode === 'id' ? field.id : field.key } })
	const entry = (id, field, value, parent) => ({ id, field, value, parent, locale: 'en' })
	siteEntries.push(
		entry('footer-item', 'footer-id', null), entry('footer-heading', 'footer-title', 'Explore', 'footer-item'),
		entry('footer-list', 'footer-links', null, 'footer-item'), entry('footer-value', 'footer-link', { page: 'home', label: 'Home footer' }, 'footer-list'),
		entry('notice-value', 'notice-id', 'Shared copyright'), entry('count-value', 'count-id', 0), entry('enabled-value', 'enabled-id', false)
	)
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
	return { ...(await loadResolver(collections, context)), context, site, section, block, records, home, about, siteEntries, siteFields, symbolFields }
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

for (const mode of ['key', 'id']) {
	test(`browser ${mode} references resolve shared navigation/footer values and editable entries without source changes`, async () => {
		const { useContent, useEntries, assertSiteFieldReferences, site, section, block, home, siteFields, symbolFields, siteEntries } = await fixture(mode)
		const before = structuredClone({ siteFields, symbolFields, siteEntries })
		assertSiteFieldReferences(site, siteFields, symbolFields)
		for (const target of ['cms', 'live']) {
			for (const entity of [section, block]) {
				const content = useContent(entity, { target, page: home }).en
				assert.equal(content.nav[0].group.link.label, 'Home')
				assert.equal(content.footer_groups[0].title, 'Explore')
				assert.equal(content.footer_groups[0].links[0].link.active, true)
				assert.equal(content.notice, 'Shared copyright')
				assert.equal(content.count, 0)
				assert.equal(content.enabled, false)
				assert.deepEqual(content.empty_list, [])
			}
		}
		assert.equal(useEntries(section, symbolFields.find(field => field.key === 'nav')).length, 7)
		assert.equal(useEntries(block, symbolFields.find(field => field.key === 'footer_groups'))[0].id, 'footer-item')
		assert.deepEqual({ siteFields, symbolFields, siteEntries }, before)
	})
}

test('browser resolution waits for loaded site fields and validates missing, nested and ambiguous references', async () => {
	const { useContent, useEntries, assertSiteFieldReferences, findSiteField, site, section, siteFields, symbolFields } = await fixture('key')
	const fields = site.fields
	site.fields = () => undefined
	assert.equal(useContent(section, { target: 'live' }), undefined)
	assert.equal(useEntries(section, symbolFields[0]), undefined)
	site.fields = fields
	for (const reference of ['missing', 'site-link-id', '', null]) {
		symbolFields[0].config.field = reference
		assert.throws(() => assertSiteFieldReferences(site, siteFields, symbolFields), /site-field reference.*block.*nav.*config.field.*top-level.*site\/fields.yaml/)
	}
	assert.equal(findSiteField([...siteFields, { id: 'decoy', key: 'site-nav-id' }], 'site-nav-id').id, 'site-nav-id')
	assert.equal(findSiteField([...siteFields, { id: 'duplicate', key: 'nav' }], 'nav'), null)
})
