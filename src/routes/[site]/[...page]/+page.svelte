<script>
	import { compilers_registered } from '$lib/stores'
	import PrimoPage from '$lib/builder/views/editor/Page.svelte'

	let { data } = $props()
</script>

{#if $compilers_registered}
	<PrimoPage
		page={{
			...data.page,
			sections: data.sections
		}}
	/>
{/if}
