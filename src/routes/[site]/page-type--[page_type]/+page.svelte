<script>
	import PageType from '$lib/builder/views/editor/PageType.svelte'
	import { compilers_registered } from '$lib/stores'

	let { data } = $props();
</script>

{#if $compilers_registered}
	<PageType
		page={{
			...data.page_type,
			sections: data.sections
		}}
	/>
{/if}
