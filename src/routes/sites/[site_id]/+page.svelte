<script>
	import { compilers_registered } from '$lib/stores'
	import PrimoPage from '$lib/builder/views/editor/Page.svelte'
	import { page as pageState } from '$app/state'
	import { Sites } from '$lib/pocketbase/collections'

	const site_id = $derived(pageState.params.site_id)
	const site = $derived(Sites.one(site_id))
	const homepage = $derived(site?.homepage())
</script>

{#if $compilers_registered && homepage}
	<PrimoPage page={homepage} />
{/if}
