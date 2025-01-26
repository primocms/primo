<script>
	import CreateBlock from '$lib/components/Modals/CreateBlock.svelte'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import * as Dialog from '$lib/components/ui/dialog'
	import CodeEditor from '$lib/builder/components/CodeEditor/CodeMirror.svelte'
	import * as code_generators from '$lib/builder/code_generators'
	import { processCode } from '$lib/builder/utils.js'
	import { get_site_data } from '$lib/builder/stores/helpers.js'
	import { Separator } from '$lib/components/ui/separator'
	import { Button } from '$lib/components/ui/button'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import { Cuboid, Code } from 'lucide-svelte'
	import MarketplaceSymbolButton from '$lib/components/MarketplaceSymbolButton.svelte'
	import * as actions from '$lib/actions'
	import { invalidate, goto } from '$app/navigation'

	/**
	 * @typedef {Object} Props
	 * @property {any} data
	 */

	/** @type {Props} */
	let { data } = $props()

	let editing_head = $state(false)
	let creating_block = $state(false)

	async function create_symbol({ code, changes, preview }) {
		await actions.create_library_symbol({ code, changes, preview })
		invalidate('app:data')
		creating_block = false
	}

	let design = $state(data.settings.value.design)
	let design_variables_css = $state(code_generators.site_design_css(design))
	function update_design_variables_css() {
		design_variables_css = code_generators.site_design_css(design)
	}

	let head_code = $state(data.settings.value.head)
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
	<div class="ml-auto mr-4 flex gap-2">
		<Button size="sm" variant="ghost" onclick={() => (editing_head = true)} aria-label="Design">
			<Code class="h-4 w-4" />
		</Button>
		<Dialog.Root bind:open={editing_head}>
			<Dialog.Content class="max-w-[900px] h-full max-h-[80vh] flex flex-col p-4 gap-4">
				<div class="space-y-2 pt-10">
					<h4 class="font-medium leading-none">Head Code</h4>
					<p class="text-muted-foreground text-sm">
						These are the styles used to ensure marketplace blocks render consistently across browsers and use standardized component styles. This code is included in marketplace starters but needs to
						be added manually to custom Starters that use marketplace blocks.
					</p>
				</div>
				<CodeEditor mode="html" bind:value={head_code} disabled={true} />
			</Dialog.Content>
		</Dialog.Root>
		<Dialog.Root bind:open={creating_block}>
			<Dialog.Content class="max-w-[1600px] h-full max-h-[100vh] flex flex-col p-4 gap-0">
				<CreateBlock onclose={() => (creating_block = false)} onsubmit={create_symbol} />
			</Dialog.Content>
		</Dialog.Root>
	</div>
</header>

<div class="flex flex-1 flex-col gap-4 px-4 pb-4">
	{#if data.symbols.length > 0}
		<ul class="blocks">
			{#each data.symbols as symbol (symbol.id)}
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
