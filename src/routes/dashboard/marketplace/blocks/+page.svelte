<script>
	import * as Sidebar from '$lib/components/ui/sidebar'
	import { processCode } from '$lib/builder/utils.js'
	import { get_site_data } from '$lib/builder/stores/helpers.js'
	import { Separator } from '$lib/components/ui/separator'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import { Cuboid, Code } from 'lucide-svelte'
	import MarketplaceSymbolButton from '$lib/components/MarketplaceSymbolButton.svelte'

	/**
	 * @typedef {Object} Props
	 * @property {any} data
	 */

	/** @type {Props} */
	let { data } = $props()

	let design_variables_css = ''

	let head_code = $state('')
	let generated_head_code = $state('')

	// Generate <head> tag code
	$effect.pre(() => {
		compile_component_head(`<svelte:head>${head_code}</svelte:head>`).then((generated) => {
			generated_head_code = generated
		})
	})

	async function compile_component_head(html) {
		const compiled = await processCode({
			component: {
				html,
				css: '',
				js: '',
				data: get_site_data({})
			}
		})
		if (!compiled.error) {
			return compiled.head
		} else return ''
	}
</script>

<header class="flex h-14 shrink-0 items-center gap-2">
	<div class="flex flex-1 items-center gap-2 px-3">
		<Sidebar.Trigger />
		<Separator orientation="vertical" class="mr-2 h-4" />
		<div class="text-sm">Blocks</div>
	</div>
</header>

<div class="flex flex-1 flex-col gap-4 px-4 pb-4">
	{#if data.marketplace_symbols.length > 0}
		<ul class="blocks">
			{#each data.marketplace_symbols as symbol (symbol.id)}
				<li>
					<MarketplaceSymbolButton symbol={symbol.data} preview={symbol.preview} head={generated_head_code + design_variables_css} />
				</li>
			{/each}
		</ul>
	{:else}
		<EmptyState icon={Cuboid} title="No Blocks to display" description="Blocks are components you can add to any site. When you create one it'll show up here." />
	{/if}
</div>

<style lang="postcss">
	ul.blocks {
		display: grid;
		gap: 1rem;
	}

	@media (min-width: 600px) {
		ul.blocks {
			grid-template-columns: 1fr 1fr;
		}
	}

	@media (min-width: 900px) {
		ul.blocks {
			grid-template-columns: 1fr 1fr 1fr;
		}
	}

	@media (min-width: 1200px) {
		ul.blocks {
			grid-template-columns: 1fr 1fr 1fr 1fr;
		}
	}
</style>
