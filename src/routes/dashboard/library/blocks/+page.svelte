<script>
	import CreateBlock from '$lib/components/modals/CreateBlock.svelte'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import * as Dialog from '$lib/components/ui/dialog'
	import CodeEditor from '$lib/builder/components/CodeEditor/CodeMirror.svelte'
	import DesignFields from '$lib/components/modals/DesignFields.svelte'
	import * as code_generators from '$lib/builder/code_generators'
	import { processCode } from '$lib/builder/utils.js'
	import { get_site_data } from '$lib/builder/stores/helpers.js'
	import { static_iframe_srcdoc } from '$lib/builder/components/misc'
	import { transform_content } from '$lib/builder/transform_data'
	import { block_html } from '$lib/builder/code_generators.js'
	import { Separator } from '$lib/components/ui/separator'
	import { Button } from '$lib/components/ui/button'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import { CirclePlus, Cuboid, Palette, Code, Upload } from 'lucide-svelte'
	import LibrarySymbolButton from '$lib/components/LibrarySymbolButton.svelte'
	import * as actions from '$lib/actions'
	import { invalidate, goto } from '$app/navigation'
	import { validate_symbol } from '$lib/builder/converter.js'
	import { remap_entry_and_field_items } from '$lib/builder/actions/_db_utils'

	/**
	 * @typedef {Object} Props
	 * @property {any} data
	 */

	/** @type {Props} */
	let { data } = $props()
	$inspect({ data })

	let editing_head = $state(false)
	let editing_design = $state(false)
	let creating_block = $state(false)

	async function upload_block_file(event) {
		const file = event.target.files[0]
		if (!file) return
		try {
			const text = await file.text()
			const uploaded = JSON.parse(text)
			const validated = validate_symbol(uploaded)
			remap_entry_and_field_items({
				entries: validated.entries,
				fields: validated.fields
			})
			const component_data = transform_content({
				entries: validated.entries,
				fields: validated.fields
			})['en']
			const generate_code = await block_html({ code: validated.code, data: component_data })
			const preview = static_iframe_srcdoc(generate_code)
			await actions.create_library_symbol({
				code: validated.code,
				changes: {
					entries: validated.entries.map((e) => ({ action: 'insert', data: e, id: e.id })),
					fields: validated.fields.map((f) => ({ action: 'insert', data: f, id: f.id }))
				},
				preview
			})
			invalidate('app:data')
		} catch (error) {
			console.error('Error processing site file:', error)
			// primo_json_valid = false
		} finally {
			// loading = false
		}
	}

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

	let loading = $state(false)
	async function save_settings() {
		loading = true
		await data.supabase
			.from('library_settings')
			.update({ value: { head: head_code, design } })
			.eq('key', 'blocks')
		editing_head = false
		editing_design = false
		loading = false
	}
</script>

<header class="flex h-14 shrink-0 items-center gap-2">
	<div class="flex flex-1 items-center gap-2 px-3">
		<Sidebar.Trigger />
		<Separator orientation="vertical" class="mr-2 h-4" />
		<div class="text-sm">Blocks</div>
	</div>
	{#if !data.user.collaborator}
		<div class="ml-auto mr-4 flex gap-2">
			<Button size="sm" variant="ghost" onclick={() => (editing_head = true)} aria-label="Design">
				<Code class="h-4 w-4" />
			</Button>
			<Dialog.Root bind:open={editing_head}>
				<Dialog.Content class="max-w-[900px] h-full max-h-[80vh] flex flex-col p-4 gap-4">
					<Dialog.Header
						title=""
						button={{
							label: 'Save',
							onclick: save_settings
						}}
					/>
					<div class="space-y-2">
						<h4 class="font-medium leading-none">Head Code</h4>
						<p class="text-muted-foreground text-sm">
							Add code that will be included in the head section when displaying blocks in this library (CSS resets, shared styles, meta tags, etc). When blocks are used in sites, they'll use the head
							code from those sites instead.
						</p>
					</div>
					<CodeEditor mode="html" bind:value={head_code} on:save={() => {}} />
				</Dialog.Content>
			</Dialog.Root>
			<Button class="mr-2" size="sm" variant="ghost" onclick={() => (editing_design = true)} aria-label="Design">
				<Palette class="h-4 w-4" />
			</Button>
			<Dialog.Root bind:open={editing_design}>
				<Dialog.Content class="max-w-[600px] h-full max-h-[90vh] flex flex-col p-4 gap-0">
					<Dialog.Header
						title="Design"
						button={{
							label: 'Save',
							onclick: save_settings
						}}
					/>
					<div
						class="overflow-auto"
						style:--label-font-size="0.875rem"
						style:--label-font-weight="400"
						style:--DesignPanel-brand-color={design['brand_color']}
						style:--DesignPanel-font-heading={design['heading_font']}
						style:--DesignPanel-border-radius={design['roundness']}
					>
						<DesignFields values={design} on:input={update_design_variables_css} />
					</div>
				</Dialog.Content>
			</Dialog.Root>
			<Button variant="outline" size="sm">
				<label class="flex items-center gap-2 cursor-pointer">
					<input onchange={upload_block_file} type="file" class="sr-only" />
					<Upload class="h-4 w-4" />
					Upload
				</label>
			</Button>
			<Button size="sm" variant="outline" onclick={() => (creating_block = true)}>
				<CirclePlus class="h-4 w-4" />
				Create Block
			</Button>
			<Dialog.Root bind:open={creating_block}>
				<Dialog.Content class="max-w-[1600px] h-full max-h-[100vh] flex flex-col p-4 gap-0">
					<CreateBlock onclose={() => (creating_block = false)} onsubmit={create_symbol} />
				</Dialog.Content>
			</Dialog.Root>
		</div>
	{/if}
</header>

<div class="flex flex-1 flex-col gap-4 px-4 pb-4">
	{#if data.symbols.length > 0}
		<ul class="blocks">
			{#each data.symbols as symbol (symbol.id)}
				<li>
					<LibrarySymbolButton {symbol} head={generated_head_code + design_variables_css} />
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
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	}
</style>
