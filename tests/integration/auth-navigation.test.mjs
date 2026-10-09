import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { auth_url, auth_destination } from '../../src/lib/auth_navigation.js'

const requested = new URL('http://localhost:3010/admin/dashboard/sites?group=selected-group#sites')

async function mountCallback(route, scope) {
	const source = await readFile(new URL(`../../src/routes/${route}`, import.meta.url), 'utf8')
	const callback = source.match(/onMount\(async \(\) => \{([\s\S]*?)\n\t\}\)/)
	assert(callback, 'Expected a route mount callback')
	return Function(...Object.keys(scope), `return (async () => {${callback[1]}\n})()`)(...Object.values(scope))
}

test('a dashboard without a session returns to its selected group after dev login', async () => {
	const navigations = []
	const goto = async (url, options) => navigations.push({ url, options })
	await mountCallback('dashboard/+layout.svelte', { page: { url: requested }, auth_url, check_session: async () => false, goto })
	assert.equal(navigations[0].url, auth_url(requested))
	await mountCallback('auth/+layout.svelte', {
		page: { url: new URL(navigations[0].url, requested.origin) },
		auth_destination,
		check_session: async () => false,
		isLocalhost: () => true,
		tryDevAuth: async () => true,
		goto
	})
	assert.deepEqual(navigations[1], { url: requested.pathname + requested.search + requested.hash, options: { replaceState: true } })
})

test('existing login sessions also honor the requested dashboard', async () => {
	let destination
	await mountCallback('auth/+layout.svelte', {
		page: { url: new URL(auth_url(requested), requested.origin) },
		auth_destination,
		check_session: async () => true,
		goto: async (url) => {
			destination = url
		}
	})
	assert.equal(destination, '/admin/dashboard/sites?group=selected-group#sites')
})

test('authenticated dashboard visits do not redirect', async () => {
	await mountCallback('dashboard/+layout.svelte', {
		page: { url: requested },
		auth_url,
		check_session: async () => true,
		goto: () => assert.fail('Authenticated dashboard should stay open')
	})
})

test('login continuation preserves a specific site and page', () => {
	const url = new URL('/admin/sites/site-id/about?view=content#details', requested.origin)
	assert.equal(auth_destination(new URL(auth_url(url), url.origin)), url.pathname + url.search + url.hash)
})

test('login without a continuation retains the default editor destination', () => {
	assert.equal(auth_destination(new URL('/admin/auth', requested.origin)), '/admin/site')
})

test('login rejects external destinations, auth loops, and paths outside admin', () => {
	for (const next of [
		'https://example.com/admin/site',
		'//example.com/admin/site',
		'/admin/auth',
		'/admin/auth?next=/admin/dashboard',
		'/admin/../../outside',
		'/admin/\\example.com/site',
		'/outside',
		'/admin/site-other'
	]) {
		const url = new URL('/admin/auth', requested.origin)
		url.searchParams.set('next', next)
		assert.equal(auth_destination(url), '/admin/site', next)
	}
})
