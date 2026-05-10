<script>
	import { compilers_registered } from '$lib/stores'
	import PrimoPage from '$lib/builder/views/editor/Page.svelte'
	import { page as pageState } from '$app/state'
	import { Sites } from '$lib/pocketbase/collections'
	import { resolve_page } from '$lib/pages'

	const site_id = $derived(pageState.params.site_id)
	const path = $derived(pageState.params.page?.split('/'))

	const site = $derived(site_id && Sites.one(site_id))
	const page = $derived(site && path && resolve_page(site, path))
</script>

{#if $compilers_registered && page}
	<PrimoPage {page} />
{/if}
