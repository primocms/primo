// Keep the requested admin page through login, including its selected group.
export const auth_url = (url) => `/admin/auth?next=${encodeURIComponent(url.pathname + url.search + url.hash)}`

export const auth_destination = (url) => {
	const next = url.searchParams.get('next')
	if (!next || !next.startsWith('/admin/')) return '/admin/site'
	try {
		const destination = new URL(next, url.origin)
		// Accept only same-origin admin routes and avoid redirecting back to auth.
		if (destination.origin !== url.origin || !/^\/admin\/(?:dashboard|sites|site)(?:\/|$)/.test(destination.pathname)) return '/admin/site'
		return destination.pathname + destination.search + destination.hash
	} catch {
		return '/admin/site'
	}
}
