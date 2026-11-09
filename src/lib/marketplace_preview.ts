import type { Site } from '$lib/common/models/Site'
import { marketplace_url } from '$lib/pocketbase/instances'

// Read only the public, stored homepage snapshot. Never fetch arbitrary live
// site URLs or change their frame-ancestors policy to make thumbnails work.
export function marketplace_preview_url(site: Pick<Site, 'id' | 'preview'>) {
	return typeof site.preview === 'string' && site.preview
		? `${marketplace_url}/api/files/sites/${encodeURIComponent(site.id)}/${encodeURIComponent(site.preview)}`
		: undefined
}

// This document must only be displayed in an iframe with an empty sandbox
// attribute (no scripts, same-origin access, forms, popups, or top navigation).
// CSP also blocks active resources; the snapshot only needs styles and images.
export function marketplace_preview_document(html: string, site_url: string) {
	const policy = document.createElement('meta')
	policy.httpEquiv = 'Content-Security-Policy'
	policy.content = "default-src 'none'; script-src 'none'; style-src https: http: 'unsafe-inline'; img-src https: http: data:; font-src https: http: data:; form-action 'none'; base-uri https: http:"
	const referrer = document.createElement('meta')
	referrer.name = 'referrer'
	referrer.content = 'no-referrer'
	const base = document.createElement('base')
	base.href = site_url
	// Install our policy and first base before any snapshot markup is parsed.
	// Do not parse remote HTML in the dashboard's document, even with DOMParser:
	// inert documents can still request resources. Only the sandbox parses it.
	// Its automatic-features restriction also blocks meta refresh navigation.
	return `<!DOCTYPE html><html><head>${policy.outerHTML}${referrer.outerHTML}${base.outerHTML}</head>${html}</html>`
}
