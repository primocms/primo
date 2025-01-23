<script lang="ts">
	import _ from 'lodash-es'
	import { Building2, Palette, LayoutTemplate, Upload, Loader, ArrowUpRight } from 'lucide-svelte'
	import * as Dialog from '$lib/components/ui/dialog'
	import SitePreview from '$lib/components/SitePreview.svelte'
	import * as Tabs from '$lib/components/ui/tabs'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input/index.js'
	import { Label } from '$lib/components/ui/label/index.js'
	import { convert_site_v3 } from '$lib/builder/new_converter'
	import DesignFields from './Modals/DesignFields.svelte'
	import Themes from './Themes.svelte'
	import * as code_generators from '$lib/builder/code_generators'
	import { page } from '$app/stores'
	import EmptyState from '$lib/components/EmptyState.svelte'

	let { onclose, onsubmit } = $props()

	let site_name = $state(``)

	let preview = $state(``)
	async function set_template_preview(data) {
		const home_page = _.cloneDeep(data.pages.find((page) => page.slug === ''))
		home_page.page_type = data.page_types.find((pt) => pt.id === home_page.page_type)
		preview = (
			await code_generators.page_html({
				page: home_page,
				site: data.site,
				page_sections: data.sections.filter((section) => section.page === home_page.id),
				page_symbols: data.symbols,
				page_list: data.pages.map((page) => ({
					...page,
					page_type: page.page_type?.id || data.page_types.find((pt) => pt.id === page.page_type)
				}))
			})
		).html
	}

	let design_values = $state({
		heading_font: 'Merriweather',
		body_font: 'Open Sans',
		brand_color: '#bc2020',
		accent_color: '#9b92c8',
		roundness: '8px',
		depth: '0px 4px 30px rgba(0, 0, 0, 0.2)'
	})
	let design_variables_css = $derived(code_generators.site_design_css(design_values))

	let selected_theme_id = $state(``)
	function select_theme(theme) {
		preview = theme.preview
		selected_theme_id = theme.id
	}

	let duplicated_site_data = $state<import('$lib').Site_Data | null>(null)
	async function duplicate_site_file(event) {
		const file = event.target.files[0]
		if (!file) return

		try {
			const text = await file.text()
			const uploaded = JSON.parse(text)

			// if (uploaded.site?.design) {
			// 	design_values = uploaded.site.design
			// }

			duplicated_site_data = convert_site_v3(uploaded)
			set_template_preview(duplicated_site_data)
		} catch (error) {
			console.error('Error processing site file:', error)
			// primo_json_valid = false
		} finally {
			// loading = false
		}
	}

	let completed = $derived(!!site_name && (selected_theme_id || duplicated_site_data))
	let loading = $state(false)
	function create_site() {
		loading = true
		onsubmit({
			starter_id: selected_theme_id,
			starter_data: null,
			details: { name: site_name, design: design_values },
			preview
		})
	}
</script>

<Dialog.Header
	class="mb-2"
	title="Create Site"
	button={{
		label: 'Done',
		onclick: create_site,
		loading,
		disabled: loading || !completed
	}}
/>

<Tabs.Root value="identity" class="w-full flex-1 flex flex-col gap-2 overflow-hidden">
	<Tabs.List class="w-full flex">
		<Tabs.Trigger value="identity" class="flex-1 flex items-center gap-2">
			<Building2 class="h-5 w-5" />
			Identity
		</Tabs.Trigger>
		<Tabs.Trigger value="design" class="flex-1 flex items-center gap-2">
			<Palette class="h-5 w-5" />
			Design
		</Tabs.Trigger>
		<Tabs.Trigger value="starter" class="flex-1 flex items-center gap-2">
			<LayoutTemplate class="h-5 w-5" />
			Starter
		</Tabs.Trigger>
	</Tabs.List>

	<div class="flex-1 max-h-[82vh]">
		<Tabs.Content value="identity" class="p-1">
			<div class="grid w-full items-center gap-1.5">
				<Label for="site-name">Site Name</Label>
				<Input type="text" id="site-name" bind:value={site_name} />
			</div>
		</Tabs.Content>

		<Tabs.Content value="design" class="h-full">
			<div class="grid grid-cols-2 h-full gal-4">
				<div class="space-y-2 overflow-y-auto">
					<DesignFields bind:values={design_values} />
				</div>
				<div class="design-preview border">
					{@html design_variables_css}
					<h1>{site_name || 'Welcome to Primo'}</h1>
					<h2>We're happy you're here</h2>
					<button>Button</button>
				</div>
			</div>
		</Tabs.Content>

		<Tabs.Content value="starter" class="h-full">
			<div class="flex flex-col h-full space-y-2">
				<div class="flex justify-between items-center">
					<h3>Choose a Starter</h3>
					<Button variant="outline" size="sm">
						<label class="flex items-center gap-2 cursor-pointer">
							<input onchange={duplicate_site_file} type="file" class="sr-only" />
							<Upload class="h-4 w-4" />
							Duplicate from site file
						</label>
					</Button>
				</div>
				{#if $page.data.starters.length > 0}
					<div class="split-container flex-1">
						<div class="h-full overflow-auto">
							<Themes on:select={({ detail }) => select_theme(detail)} append={design_variables_css} />
						</div>
						<div style="background: #222;" class="rounded">
							{#if preview}
								<SitePreview style="height: 100%" site_id={selected_theme_id} {preview} append={design_variables_css} />
							{/if}
						</div>
					</div>
				{:else}
					<EmptyState
						icon={LayoutTemplate}
						title="You don't have any Starters"
						description="You need at least one Starter before you can build a site, or duplicate from a site file."
						link={{ icon: ArrowUpRight, label: 'Go to Starters', url: '/dashboard/library/starters' }}
					/>
				{/if}
			</div>
		</Tabs.Content>
	</div>
</Tabs.Root>

<!-- <div class="flex justify-end gap-3">
	<Button variant="outline" onclick={onclose}>Cancel</Button>
	<Button variant="default" onclick={create_site} disabled={loading || !completed} class="inline-flex justify-center items-center">
		<span class:invisible={loading}>Create Site</span>
		{#if loading}
			<div class="animate-spin absolute">
				<Loader />
			</div>
		{/if}
	</Button>
</div> -->

<style lang="postcss">
	.design-preview {
		background: white;
		color: #222;
		padding: 2rem;
		border-radius: var(--border-radius);
		h1 {
			font-size: 2rem;
			font-family: var(--font-heading);
		}
		h2 {
			font-size: 1.125rem;
			font-family: var(--font-body);
			margin-bottom: 1rem;
		}
		button {
			padding: 0.25rem 0.75rem;
			background: var(--color-brand);
			color: white;
			border-radius: var(--border-radius);
		}
	}
	.split-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		overflow: hidden;
	}
</style>
