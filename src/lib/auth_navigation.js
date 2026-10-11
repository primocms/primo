// Keep the requested admin page through login, including its selected group.
export const auth_url = (url) => `/admin/auth?next=${encodeURIComponent(url.pathname + url.search + url.hash)}`

export const auth_destination = (url, user) => {
	const fallback = user && !user.serverRole ? '/admin/dashboard/sites' : '/admin/site'
	const next = url.searchParams.get('next')
	if (!next || !next.startsWith('/admin/')) return fallback
	try {
		const destination = new URL(next, url.origin)
		// Accept only same-origin admin routes and avoid redirecting back to auth.
		if (destination.origin !== url.origin || !/^\/admin\/(?:dashboard|sites|site)(?:\/|$)/.test(destination.pathname)) return fallback
		return destination.pathname + destination.search + destination.hash
	} catch {
		return fallback
	}
}
