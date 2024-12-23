<script>
	import axios from 'axios'
	import _ from 'lodash-es'
	import SiteThumbnail from '$lib/components/SiteThumbnail.svelte'
	import UI from '$lib/builder/ui'
	import * as code_generators from '$lib/builder/code_generators'
	import Icon from '@iconify/svelte'
	import { validate_site_structure_v3 } from '$lib/builder/new_converter'
	import Themes from '../Themes.svelte'
	import DesignFields from './DesignFields.svelte'
	import ModalHeader from '$lib/components/ModalHeader.svelte'
	import BlockPicker from '$lib/components/BlockPicker.svelte'
	import Button from '$lib/builder/ui/Button.svelte'

	let { onSuccess = (newSite, preview) => {}, onCancel = () => {} } = $props()

	let loading = false
	let finishing = $state(false)
	let site_name = $state(``)
	let custom_domain = $state(``)
	let selected_theme = $state()

	let site_bundle = []

	let duplicated_site = $state(null)
	let duplicating_site = $state(false)
	let primo_json_valid = true
	function readJsonFile({ target }) {
		loading = true
		duplicating_site = true

		var reader = new window.FileReader()
		reader.onload = async function ({ target }) {
			if (typeof target.result !== 'string') return

			const uploaded = JSON.parse(target.result)

			if (uploaded.site.design) {
				design_values = uploaded.site.design
			}
			try {
				duplicated_site = validate_site_structure_v3(uploaded)
				set_template_preview(duplicated_site)
			} catch (e) {
				console.error(e)
				primo_json_valid = false
			}
			loading = false
		}
		reader.readAsText(target.files[0])
	}

	let current_step = $state('identity')

	let design_values = $state({
		heading_font: 'Merriweather',
		body_font: 'Open Sans',
		brand_color: '#bc2020',
		accent_color: '#9b92c8',
		roundness: '8px',
		depth: '0px 4px 30px rgba(0, 0, 0, 0.2)'
	})
	let design_variables_css = $state(code_generators.site_design_css(design_values))

	function update_design_variables_css() {
		design_variables_css = code_generators.site_design_css(design_values)
	}

	let preview = $state('')
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

	async function select_theme(theme) {
		preview = theme.preview
		selected_theme = validate_site_structure_v3(theme.data)
	}

	let primo_blocks = $state([])
	get_primo_blocks()
	async function get_primo_blocks() {
		const { data } = await axios.get('https://raw.githubusercontent.com/mateomorris/primo-library/main/primo.json')
		primo_blocks = data.symbols
	}

	let selected_symbols = $state([])

	async function create_site() {
		finishing = true
		if (duplicating_site) {
			duplicated_site.site.name = site_name
			duplicated_site.site.design = design_values
			duplicated_site.site.custom_domain = custom_domain
			duplicated_site.symbols = [...duplicated_site.symbols, ...selected_symbols]
			onSuccess(duplicated_site, preview)
		} else {
			selected_theme.site.name = site_name
			selected_theme.site.design = design_values
			selected_theme.site.custom_domain = custom_domain
			selected_theme.symbols = [...selected_theme.symbols, ...selected_symbols]
			onSuccess(selected_theme, preview, site_bundle)
		}
	}
</script>

<ModalHeader
	title="Create a Site"
	icon="gridicons:create"
	warn={() => {
		return true
	}}
	onclose={onCancel}
/>

{#if !finishing}
	<div class="tabs">
		<button class:active={current_step === 'identity'} onclick={() => (current_step = 'identity')}>
			<Icon icon="octicon:info-16" />
			<span>Details</span>
		</button>
		<button class:active={current_step === 'design'} onclick={() => (current_step = 'design')}>
			<Icon icon="solar:pallete-2-bold" />
			<span>Design</span>
		</button>
		<button class:active={current_step === 'template'} onclick={() => (current_step = 'template')}>
			<Icon icon="heroicons-solid:template" />
			<span>Starters</span>
		</button>
		<!-- <button class:active={current_step === 'blocks'} on:click={() => (current_step = 'blocks')}>
			<Icon icon="lucide:blocks" />
			<span>Blocks</span>
		</button> -->
		<!-- <button class:active={current_step === 'addons'} on:click={() => (current_step = 'addons')}>
			<Icon icon="fluent:collections-add-20-filled" />
			<span>Add-ons</span>
		</button> -->
	</div>
{/if}
<main class="primo-reset primo-modal">
	{#if !finishing}
		{#if current_step === 'identity'}
			<form>
				<UI.TextInput autofocus={true} label="Site Name" bind:value={site_name} />
				<!-- <UI.TextInput autofocus={true} label="Site Description" bind:value={description} /> -->
				<!-- <UI.TextInput label="Domain Name" bind:value={custom_domain} /> -->
			</form>
		{:else if current_step === 'design'}
			<div class="split-container" style="overflow:hidden;">
				<div style="overflow: auto;">
					<DesignFields values={design_values} on:input={update_design_variables_css} />
				</div>
				<div>
					{@html design_variables_css}
					<div class="design-preview">
						<h1>{site_name || 'Welcome to CortaCMS'}</h1>
						<h2>We're happy you're here</h2>
						<button>Button</button>
					</div>
				</div>
			</div>
		{:else if current_step === 'template'}
			<div class="split-container">
				<div>
					<form
						onsubmit={(e) => {
							e.preventDefault()
							create_site()
						}}
					>
						<Themes on:select={({ detail }) => select_theme(detail)} append={design_variables_css} />
						<footer>
							<div id="upload-json">
								<label class="container">
									<input onchange={readJsonFile} type="file" id="primo-json" accept=".json" />
									<Icon icon="carbon:upload" />
									<span>Duplicate from site file</span>
								</label>
							</div>
						</footer>
					</form>
				</div>
				<div style="background: #222;border-radius: 0.25rem;">
					{#if preview}
						<SiteThumbnail style="height: 100%" {preview} append={design_variables_css} />
					{/if}
				</div>
			</div>
		{:else if current_step === 'blocks'}
			<div style="max-height: 75vh; overflow: auto;">
				<BlockPicker blocks={primo_blocks} site={selected_theme?.site || duplicated_site?.site} bind:selected={selected_symbols} append={code_generators.site_design_css(design_values)} />
			</div>
		{:else if current_step === 'addons'}
			<div style="max-height: 75vh; overflow: auto;">
				<div class="addon-item">
					<h2>Form Builder</h2>
					<p>Easily build forms and integrate them into your Blocks.</p>
				</div>
			</div>
		{/if}
	{:else}
		<div class="creating-site">
			<Icon icon="eos-icons:three-dots-loading" width="50" />
			<span>{duplicating_site ? 'Duplicating' : 'Creating'} {site_name}</span>
		</div>
	{/if}
</main>
{#if !finishing}
	<footer>
		{#if current_step === 'identity'}
			<Button onclick={() => (current_step = 'design')} label="Design" arrow={true} />
		{:else if current_step === 'design'}
			<Button onclick={() => (current_step = 'template')} label="Starters" arrow={true} />
		{:else if current_step === 'template'}
			<Button icon="gridicons:create" onclick={create_site} label="Create Site" />
			<!-- <Button on:click={() => (current_step = 'blocks')} label="Blocks" arrow={true} /> -->
			<!-- {:else if current_step === 'blocks'}
		<Button on:click={() => (current_step = 'addons')} label="Add-ons" arrow={true} />
	{:else if current_step === 'addons' && !finishing}
		<Button icon="gridicons:create" on:click={create_site} label="Create Site" /> -->
		{/if}
	</footer>
{/if}

<style lang="postcss">
	.tabs {
		display: flex;
		justify-content: center;
		color: white;
		/* margin-bottom: 1rem; */

		button {
			font-size: 0.875rem;
			padding: 0.75rem 1rem;
			display: flex;
			align-items: center;
			gap: 0.25rem;
			border-bottom: 1px solid #222;
			transition: 0.1s;

			&.active {
				border-bottom-color: var(--primo-color-brand);
			}
		}
	}
	main {
		width: 100%;
		display: grid;
		grid-template-rows: auto 1fr;
		max-height: calc(90vh - 67px);
		padding-bottom: 0;
		padding-top: 0.5rem;
	}
	.split-container {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}
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
	.primo-modal {
		/* max-width: 1200px; */
		padding-inline: 1rem;

		form {
			display: grid;
			gap: 1rem;
		}
	}
	footer {
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		z-index: 99;
		background: var(--color-gray-9);
		padding: 0.5rem 1rem;
		justify-content: flex-end;
		.container {
			margin-bottom: 1rem;
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}
		span {
			color: var(--color-gray-3);
			font-size: 0.75rem;
			text-decoration: underline;
		}
	}
	#upload-json {
		margin-bottom: 0.5rem;
		display: flex;
		justify-content: flex-start;

		label {
			cursor: pointer;

			input {
				display: none;
			}

			span {
				color: var(--color-gray-3);
				font-size: 0.75rem;
				text-decoration: underline;
			}
		}
	}

	.error {
		padding: 1rem;
		background: #b00020;
		margin-bottom: 1rem;
	}

	.creating-site {
		display: flex;
		align-items: center;
		padding: 1rem;
		padding-bottom: 3rem;
		justify-content: center;
		font-size: 1.5rem;
		flex-direction: column;
	}
</style>
