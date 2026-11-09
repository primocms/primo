<script lang="ts">
	import type { Site } from '$lib/common/models/Site'
	import SitePreview from './SitePreview.svelte'
	import { marketplace_site_url } from '$lib/site_host'
	import { marketplace_preview_document, marketplace_preview_url } from '$lib/marketplace_preview'

	let { site, style }: { site: Site; style?: string } = $props()
	let preview_document = $state<string>()
	let status = $state('Loading preview…')

	$effect(() => {
		const url = marketplace_preview_url(site)
		const base = marketplace_site_url(site)
		const controller = new AbortController()
		let active = true
		preview_document = undefined
		status = url ? 'Loading preview…' : 'Preview unavailable'
		const timeout = setTimeout(() => controller.abort(), 15000)
		if (url) {
			fetch(url, { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
				.then(async response => {
					if (!response.ok) throw new Error('Preview unavailable')
					const html = await response.text()
					if (active) preview_document = marketplace_preview_document(html, base)
				})
				.catch(() => { if (active) status = 'Preview unavailable' })
				.finally(() => clearTimeout(timeout))
		}
		return () => {
			active = false
			controller.abort()
			clearTimeout(timeout)
		}
	})
</script>

<SitePreview {site} {style} {preview_document} placeholder={status} snapshot />
