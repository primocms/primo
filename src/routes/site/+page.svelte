<script lang="ts">
	import { compilers_registered } from '$lib/stores'
	import PrimoPage from '$lib/builder/views/editor/Page.svelte'
	import { page as pageState } from '$app/state'
	import { Sites } from '$lib/pocketbase/collections'

	const host = $derived(pageState.url.host)
	const site = $derived(Sites.list({ filter: { host } })?.[0])
	const page = $derived(site?.homepage())
</script>

{#if $compilers_registered && page}
	<PrimoPage {page} />
{/if}
