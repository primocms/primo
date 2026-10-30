<script lang="ts">
	import { onDestroy } from 'svelte'
	import { toast } from 'svelte-sonner'
	import { cloneDeep, isEqual } from 'lodash-es'
	import { page } from '$app/state'
	import { PageTypes, type Sites } from '$lib/pocketbase/collections'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { resolve_page } from '$lib/pages'
	import { useContent } from '$lib/Content.svelte'
	import { processCode } from '$lib/builder/utils'
	import { locale } from '../stores/app/misc'
	import { site_html } from '../stores/app/page'

	let { site }: { site: ObjectOf<typeof Sites> } = $props()

	const active_page = $derived(page.params.page_type ? undefined : page.params.page ? resolve_page(site, page.params.page.split('/')) : site.homepage())
	const page_type_id = $derived(page.params.page_type || active_page?.page_type)
	const page_type = $derived(page_type_id ? PageTypes.one(page_type_id) : undefined)
	const content_entity = $derived(active_page ?? page_type)
	const site_content = $derived(useContent(site, { target: 'cms', page: active_page ?? undefined }))
	const page_content = $derived(content_entity ? useContent(content_entity, { target: 'cms', page: active_page ?? undefined }) : undefined)

	type HeadInput = { site: string; page?: string; page_type?: string; locale: string; code: string; data: Record<string, unknown> }
	let last_input: HeadInput | undefined
	let request = 0
	let suspended = $state(false)

	$effect(() => {
		if (suspended) return
		// Wait for the viewed page/type and its content, rather than compiling
		// expressions against an incomplete set of props during navigation.
		if (!site_content || (page_type_id && !page_type) || (content_entity && !page_content)) {
			request++
			last_input = undefined
			$site_html = null
			return
		}

		const input: HeadInput = {
			site: site.id,
			page: active_page?.id,
			page_type: page_type?.id,
			locale: $locale,
			// Match publishing: site head first, then the type's overrides, with
			// page content taking precedence over site content of the same name.
			code: (site.head ?? '') + (page_type?.head ?? ''),
			data: { ...site_content[$locale], ...page_content?.[$locale] }
		}
		if (isEqual(last_input, input)) return
		last_input = cloneDeep(input)
		const current_request = ++request

		processCode({
			component: { html: `<svelte:head>${input.code}</svelte:head>`, css: '', js: '', data: input.data }
		})
			.then((compiled) => {
				if (current_request !== request) return
				if (compiled.error) throw new Error(compiled.error)
				$site_html = compiled.head ?? ''
				toast.dismiss('site-head-compile-error')
			})
			.catch((error) => {
				if (current_request !== request) return
				$site_html = ''
				console.error('Preview head compilation failed:', error)
				toast.error('Page head could not be compiled. Reload to retry.', { id: 'site-head-compile-error' })
			})
	})

	onDestroy(() => {
		// A compile started on a previous page/site must never replace the
		// current preview head, including after this editor has unmounted.
		request++
		$site_html = null
	})
</script>

<svelte:window
	onpagehide={() => { request++; last_input = undefined; suspended = true }}
	onpageshow={(event) => { if (event.persisted) suspended = false }}
/>
