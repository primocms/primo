<script lang="ts">
	import _ from 'lodash-es'
	import { FilePlus, Upload, Loader, X } from 'lucide-svelte'
	import { Separator } from '$lib/components/ui/separator'
	import * as Dialog from '$lib/components/ui/dialog'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { Label } from '$lib/components/ui/label'
	import { convert_site_v3, validate_site_data } from '$lib/builder/new_converter'
	import DropZone from '$lib/components/DropZone.svelte'
	import SitePreview from '$lib/components/SitePreview.svelte'
	import * as code_generators from '$lib/builder/code_generators'

	let { onclose, onsubmit } = $props()

	let starter_name = $state(``)
	let starter_description = $state(``)

	let method = $state('')

	let site_data
	let primo_json_invalid = $state(false)
	async function upload_site_file(file) {
		const text = await file.text()
		const data = JSON.parse(text)
		const valid = validate_site_data(data)
		if (!valid) {
			primo_json_invalid = true
		} else {
			site_data = _.cloneDeep(convert_site_v3(data))
			console.log({ site_data })
			set_template_preview(site_data)
			primo_json_invalid = false
		}
	}

	let generating_site_preview = $state(false)
	let site_preview = $state(``)
	async function set_template_preview(data) {
		generating_site_preview = true
		const home_page = _.cloneDeep(data.pages.find((page) => page.slug === ''))
		home_page.page_type = data.page_types.find((pt) => pt.id === home_page.page_type)
		site_preview = (
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
		generating_site_preview = false
	}

	let completed = $derived(starter_name && (method === 'scratch' || (method === 'duplicate' && !primo_json_invalid)))

	let loading = $state(false)
	function create_starter() {
		loading = true
		onsubmit({
			details: { name: starter_name, description: starter_description },
			site_data,
			preview: site_preview
		})
	}
</script>

<Dialog.Header
	class="mb-2"
	title="Create Starter"
	button={{
		label: 'Done',
		onclick: create_starter,
		disabled: loading || !completed,
		loading
	}}
/>

<div class="flex-1 max-h-[77vh] space-y-4">
	<div class="grid w-full items-center gap-1.5">
		<Label for="site-name">Starter Name</Label>
		<Input type="text" id="site-name" bind:value={starter_name} />
	</div>
	<div class="grid w-full items-center gap-1.5">
		<Label for="site-description">Starter Description</Label>
		<Input type="text" id="site-description" bind:value={starter_description} />
	</div>
	<div class="flex">
		<Button onclick={() => (method = 'scratch')} variant={method === 'scratch' ? 'secondary' : 'outline'} class="w-full border-r-0 rounded-tr-none rounded-br-none">
			<FilePlus class="h-4 w-4" />
			Create from scratch
		</Button>
		<Separator orientation="vertical" />
		<Button onclick={() => (method = 'duplicate')} variant={method === 'duplicate' ? 'secondary' : 'outline'} class="w-full border-l-0 rounded-tl-none rounded-bl-none">
			<Upload class="h-4 w-4" />
			Duplicate from site file
		</Button>
	</div>
	{#if method === 'duplicate'}
		<div class="grid gap-2" class:grid-cols-3={generating_site_preview || site_preview}>
			<div class="col-span-2">
				<DropZone class="h-full" invalid={primo_json_invalid} onupload={upload_site_file} />
			</div>
			<div class="relative bg-gray-900 rounded overflow-hidden">
				{#if generating_site_preview}
					<div class="flex items-center justify-center h-full">
						<div class="animate-spin absolute">
							<Loader />
						</div>
					</div>
				{:else if site_preview}
					<SitePreview preview={site_preview} />
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- <div class="flex justify-end gap-3">
	<Button variant="outline" onclick={onclose}>Cancel</Button>
	<Button variant="default" onclick={create_starter} disabled={loading || !completed} class="inline-flex justify-center items-center">
		<span class:invisible={loading}>Create Starter</span>
		{#if loading}
			<div class="animate-spin absolute">
				<Loader />
			</div>
		{/if}
	</Button>
</div> -->
