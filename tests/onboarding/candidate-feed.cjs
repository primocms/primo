// Test-only delivery substitution. Route values remain JSON data, never code.
const fs = require('node:fs')
const routes = JSON.parse(fs.readFileSync(process.env.PRIMO_TEST_RELEASE_ROUTES, 'utf8'))
const original = globalThis.fetch
globalThis.fetch = (input, options) => {
	const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
	return original(Object.hasOwn(routes, url) ? routes[url] : input, options)
}
