<script>
	import _ from 'lodash-es'
	import fileSaver from 'file-saver'
	import axios from 'axios'
	import { userRole } from '../../stores/app/misc.js'
	import modal from '../../stores/app/modal.js'
	import site from '../../stores/data/site.js'
	import { page } from '$app/stores'
	import { goto } from '$app/navigation'
	import { browser } from '$app/environment'
	import page_type from '../../stores/data/page_type.js'
	import symbols from '../../stores/data/symbols.js'
	import UI from '../../ui/index.js'
	import Icon from '@iconify/svelte'
	import { debounce } from '$lib/builder/utils'
	import { site_design_css } from '../../code_generators.js'
	import Sidebar_Symbol from './Sidebar_Symbol.svelte'
	import Content from '$lib/builder/components/Content.svelte'
	import { toggle_symbol, update_page_type_entries } from '../../actions/page_types.js'
	import { move_block, rename_block, update_block, add_block_to_site, delete_block_from_site, add_multiple_symbols } from '$lib/builder/actions/symbols.js'
	import { v4 as uuidv4 } from 'uuid'
	import { validate_symbol } from '../../converter.js'
	import { flip } from 'svelte/animate'
	import { dropTargetForElements } from '../../libraries/pragmatic-drag-and-drop/entry-point/element/adapter.js'
	import { attachClosestEdge, extractClosestEdge } from '../../libraries/pragmatic-drag-and-drop-hitbox/closest-edge.js'
	import { site_html } from '$lib/builder/stores/app/page'

	// get the query param to set the tab when navigating from page (i.e. 'Edit Fields')
	let active_tab = $state($page.url.searchParams.get('t') === 'p' ? 'PROPERTIES' : 'BLOCKS')
	if (browser) {
		const url = new URL($page.url)
		url.searchParams.delete('t')
		goto(url, { replaceState: true })
	}

	async function create_block() {
		modal.show(
			'BLOCK_EDITOR',
			{
				header: {
					title: `Create Block'}`,
					icon: 'fas fa-check',
					button: {
						label: `Save Block`,
						icon: 'fas fa-check',
						onclick: (new_block, changes) => {
							add_block_to_site({
								symbol: new_block,
								changes,
								index: 0
							})
							modal.hide()
						}
					}
				},
				tab: 'code'
			},
			{
				showSwitch: true,
				disabledBgClose: true
			}
		)
	}

	function edit_block(block) {
		modal.show(
			'BLOCK_EDITOR',
			{
				block,
				header: {
					title: `Edit ${block.title || 'Block'}`,
					icon: 'fas fa-check',
					button: {
						label: `Save Block`,
						icon: 'fas fa-check',
						onclick: (updated_data, changes) => {
							modal.hide()
							update_block({ block, updated_data, changes })
						}
					}
				},
				tab: 'code'
			},
			{
				showSwitch: true,
				disabledBgClose: true
			}
		)
	}

	async function show_block_picker() {
		modal.show(
			'BLOCK_PICKER',
			{
				site: $site,
				append: site_design_css($site.design),
				onsave: (symbols) => {
					add_multiple_symbols(symbols)
					modal.hide()
				}
			},
			{
				hideLocaleSelector: true
			}
		)
	}

	async function delete_block(block) {
		delete_block_from_site(block)
	}

	async function duplicate_block(block_id, index) {
		const symbol = $symbols.find((s) => s.id === block_id)
		const new_symbol = _.cloneDeep(symbol)
		new_symbol.id = uuidv4()
		delete new_symbol.created_at
		new_symbol.name = `${new_symbol.name} (copy)`
		add_block_to_site({
			symbol: new_symbol,
			changes: {
				fields: new_symbol.fields.map((f) => ({ action: 'insert', id: f.id, data: f })),
				entries: new_symbol.entries.map((c) => ({ action: 'insert', id: c.id, data: c }))
			},
			index
		})
	}

	async function upload_block({ target }) {
		var reader = new window.FileReader()
		reader.onload = async function ({ target }) {
			if (typeof target.result !== 'string') return
			try {
				const uploaded = JSON.parse(target.result)
				const validated = validate_symbol(uploaded)
				add_block_to_site({
					symbol: validated,
					changes: {
						entries: validated.entries.map((e) => ({ action: 'insert', data: e, id: e.id })),
						fields: validated.fields.map((f) => ({ action: 'insert', data: f, id: f.id }))
					},
					index: 0
				})
			} catch (error) {
				console.error(error)
			}
		}
		reader.readAsText(target.files[0])
	}

	async function download_block(block_id) {
		const block = $symbols.find((s) => s.id === block_id)
		const json = JSON.stringify(block)
		var blob = new Blob([json], { type: 'application/json' })
		fileSaver.saveAs(blob, `${block.name || block.id}.json`)
	}

	async function get_primo_blocks() {
		const { data } = await axios.get('https://raw.githubusercontent.com/mateomorris/primo-library/main/primo.json')
		return data.symbols.map((s) => ({ ...s, _drag_id: uuidv4() }))
	}

	let dragging = $state(null)

	function drag_target(element, block) {
		dropTargetForElements({
			element,
			getData({ input, element }) {
				return attachClosestEdge(
					{ block },
					{
						element,
						input,
						allowedEdges: ['top', 'bottom']
					}
				)
			},
			onDrag({ self, source }) {
				// if (dragging.id !== self.data.block.id) {
				// 	// dragging = {
				// 	// 	id: self.data.block.id,
				// 	// 	position: extractClosestEdge(self.data)
				// 	// }
				// }
			},
			onDragLeave() {
				// reset_drag()
			},
			onDrop({ self, source }) {
				const block_dragged_over_index = $symbols.find((s) => s.id === self.data.block.id).index
				const block_being_dragged = source.data.block
				const closestEdgeOfTarget = extractClosestEdge(self.data)
				if (closestEdgeOfTarget === 'top') {
					move_block(block_being_dragged, block_dragged_over_index)
				} else if (closestEdgeOfTarget === 'bottom') {
					move_block(block_being_dragged, block_dragged_over_index + 1)
				}
				// reset_drag()
			}
		})
	}
</script>

<div class="sidebar primo-reset">
	<UI.Tabs
		variant="secondary"
		tabs={[
			{
				id: 'BLOCKS',
				icon: 'lucide:blocks',
				label: `Blocks`
			},
			{
				id: 'PROPERTIES',
				icon: 'material-symbols:article-outline',
				label: `Properties`
			}
		]}
		bind:active_tab_id={active_tab}
		disable_hotkeys={true}
	/>
	<div class="container">
		{#if active_tab === 'BLOCKS'}
			{#if $symbols.length > 0}
				<div class="primo-buttons">
					<button class="primo-button" onclick={show_block_picker}>
						<Icon icon="mdi:plus" />
						<span>Add</span>
					</button>
					{#if $userRole === 'DEV'}
						<button class="primo-button" onclick={create_block}>
							<Icon icon="mdi:code" />
							<span>Create</span>
						</button>
					{/if}
					<label class="primo-button">
						<input onchange={upload_block} type="file" accept=".json" />
						<Icon icon="mdi:upload" />
						<span>Upload</span>
					</label>
				</div>
				<!-- svelte-ignore missing_declaration -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				{#if $site_html !== null}
					<div class="block-list">
						{#each $symbols.sort((a, b) => a.index - b.index) as symbol, i (symbol.id)}
							{@const toggled = symbol.page_types?.includes($page_type.id)}
							<div class="block" animate:flip={{ duration: 200 }} use:drag_target={symbol}>
								<Sidebar_Symbol
									{symbol}
									head={$site_html}
									append={site_design_css($site.design)}
									show_toggle={true}
									{toggled}
									on:toggle={({ detail }) => {
										if (detail === toggled) return // dispatches on creation for some reason
										toggle_symbol({
											symbol_id: symbol.id,
											page_type_id: $page_type.id,
											toggled: detail
										})
									}}
									onmousedown={() => (dragging = symbol._drag_id)}
									onmouseup={() => (dragging = null)}
									on:edit={() => edit_block(symbol)}
									on:rename={({ detail: name }) => rename_block({ block: symbol, name })}
									on:download={() => download_block(symbol.id)}
									on:delete={() => delete_block(symbol)}
									on:duplicate={() => duplicate_block(symbol.id, i + 1)}
								/>
							</div>
						{/each}
					</div>
				{:else}
					<div style="display: flex;justify-content: center;font-size: 2rem;color:var(--color-gray-6)">
						<UI.Spinner variant="loop" />
					</div>
				{/if}
			{:else}
				<div class="empty">Add a Block to your site to use it on your pages.</div>
				<div class="primo-buttons">
					<button class="primo-button" onclick={show_block_picker}>
						<Icon icon="mdi:plus" />
						<span>Add</span>
					</button>
					<button class="primo-button" onclick={create_block}>
						<Icon icon="mdi:code" />
						<span>Create</span>
					</button>
					<label class="primo-button">
						<input onchange={upload_block} type="file" accept=".json" />
						<Icon icon="mdi:upload" />
						<span>Upload</span>
					</label>
				</div>
			{/if}
		{:else}
			<div class="page-type-fields">
				{#if $userRole === 'DEV'}
					<button class="primo--link" style="margin-bottom: 1rem" onclick={() => modal.show('PAGE_EDITOR')}>
						<Icon icon="mdi:code" />
						<span>Edit Page Type</span>
					</button>
				{/if}
				<Content
					fields={$page_type.fields}
					entries={$page_type.entries}
					on:input={debounce({
						instant: ({ detail }) => update_page_type_entries.store(detail),
						delay: ({ detail }) => update_page_type_entries.db(detail)
					})}
					minimal={true}
				/>
			</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	.sidebar {
		width: 100%;
		background: #111;
		z-index: 9;
		display: flex;
		flex-direction: column;
		/* height: calc(100vh - 59px); */
		height: 100%;
		/* gap: 0.5rem; */
		z-index: 9;
		position: relative;
		overflow: hidden;
		/* padding-top: 0.5rem; */
	}

	.empty {
		font-size: 0.75rem;
		color: var(--color-gray-2);
		padding-bottom: 0.25rem;
	}

	.primo-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.primo-button {
		padding: 0.25rem 0.5rem;
		/* color: #b6b6b6;
			background: #292929; */
		color: var(--color-gray-2);
		background: var(--color-gray-8);
		border-radius: 4px;
		cursor: pointer;
		display: flex;
		gap: 0.25rem;
		align-items: center;
		font-size: 0.75rem;

		input {
			display: none;
		}
	}

	.container {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		padding: 1rem;
		gap: 0.75rem;
	}

	.block-list {
		/* gap: 1rem; */
		flex: 1;
		display: flex;
		flex-direction: column;

		.block {
			padding-block: 0.5rem;
		}

		.block:first-child {
			padding-top: 0;
		}
	}
</style>
