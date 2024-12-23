<script>
	import { onMount, createEventDispatcher, getContext } from 'svelte'
	import _ from 'lodash-es'
	import axios from 'axios'
	import Icon from '@iconify/svelte'
	import Toggle from 'svelte-toggle'
	import { userRole } from '../../stores/app/misc'
	import MenuPopup from '../../ui/Dropdown.svelte'
	import { get_symbol_usage_info, get_content_with_synced_values } from '../../stores/helpers'
	import { locale } from '../../stores/app/misc'
	import { click_to_copy } from '../../utilities'
	import { block_html } from '../../code_generators.js'
	import { draggable } from '../../libraries/pragmatic-drag-and-drop/entry-point/element/adapter.js'

	import { browser } from '$app/environment'
	import IFrame from '../../components/IFrame.svelte'
	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {any} symbol
	 * @property {boolean} [controls_enabled]
	 * @property {boolean} [show_toggle]
	 * @property {boolean} [toggled]
	 * @property {string} [head]
	 * @property {string} [append]
	 */

	/** @type {Props} */
	let { symbol = $bindable(), controls_enabled = true, show_toggle = false, toggled = false, head = '', append = '' } = $props()

	let name_el = $state()

	let renaming = $state(false)
	async function toggle_name_input() {
		renaming = !renaming
		// workaround for inability to see cursor when div empty
		if (symbol.name === '') {
			symbol.name = 'Block'
		}
	}

	let height = $state(0)

	let componentCode = $state()
	let cachedSymbol = {}
	let component_error = $state()
	async function compile_component_code(symbol, language) {
		if (_.isEqual(cachedSymbol.code, symbol.code) && _.isEqual(cachedSymbol.entries, symbol.entries)) {
			return
		}
		const code = {
			html: symbol.code.html,
			css: symbol.code.css,
			js: symbol.code.js
		}
		const data = get_content_with_synced_values({ entries: symbol.entries, fields: symbol.fields })[$locale]
		const res = await axios
			.post(`/api/render`, {
				id: symbol.id,
				code,
				data,
				dev_mode: false
			})
			.catch((e) => console.error(e))
		if (res?.data?.error) {
			component_error = res.data.error
		} else if (res?.data) {
			const updated_componentCode = res.data
			if (!_.isEqual(componentCode, updated_componentCode)) {
				componentCode = updated_componentCode
				cachedSymbol = _.cloneDeep({ code: symbol.code, entries: symbol.entries })
			}

			component_error = null
		} else {
			// fallback if cloud render doesn't work (i.e. browser dependencies)
			const compiled = await block_html({
				code,
				data
			})
			const updated_componentCode = compiled
			if (!_.isEqual(componentCode, updated_componentCode)) {
				componentCode = updated_componentCode
				cachedSymbol = _.cloneDeep({ code: symbol.code, entries: symbol.entries })
			}
		}
	}

	let active_symbol_label = ''
	async function get_label() {
		active_symbol_label = await get_symbol_usage_info(symbol.id)
	}

	let element = $state()
	$effect(() => {
		draggable({
			element,
			getInitialData: () => ({ block: symbol })
		})
	})
	// move cursor to end of name
	$effect(() => {
		if (name_el) {
			const range = document.createRange()
			const sel = window.getSelection()
			range.setStart(name_el, 1)
			range.collapse(true)

			sel?.removeAllRanges()
			sel?.addRange(range)
		}
	})
	$effect(() => {
		browser && compile_component_code(symbol, $locale)
	})
</script>

<div class="sidebar-symbol">
	<header>
		{#if renaming}
			<!-- svelte-ignore a11y_autofocus -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={name_el}
				contenteditable
				autofocus
				class="name"
				onblur={toggle_name_input}
				onkeydown={(e) => {
					if (e.code === 'Enter') {
						e.preventDefault()
						e.target.blur()
						dispatch('rename', e.target.textContent)
						renaming = false
					}
				}}
			>
				{symbol.name}
			</div>
		{:else}
			<div class="name">
				<h3>{symbol.name}</h3>
				{#if controls_enabled}
					<!-- TODO: add popover w/ symbol info -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<!-- <div
						class="info"
						title={active_symbol_label}
						on:mouseover={get_label}
						on:focus={get_label}
					>
						<Icon icon="mdi:info" />
					</div> -->
				{/if}
			</div>
		{/if}
		{#if controls_enabled}
			<div class="symbol-options">
				{#if show_toggle}
					<Toggle label="Toggle Symbol for Page Type" disabled={component_error} hideLabel={true} {toggled} small={true} on:toggle />
				{/if}
				<MenuPopup
					icon="carbon:overflow-menu-vertical"
					options={[
						...(getContext('DEBUGGING')
							? [
									{
										label: `${symbol.id.slice(0, 5)}...`,
										icon: 'ph:copy-duotone',
										on_click: (e) => click_to_copy(e.target, symbol.id)
									}
								]
							: []),
						...($userRole === 'DEV'
							? [
									{
										label: 'Edit Block',
										icon: 'material-symbols:code',
										on_click: () => dispatch('edit')
									},
									{
										label: 'Duplicate',
										icon: 'bxs:duplicate',
										on_click: () => dispatch('duplicate')
									}
								]
							: []),
						{
							label: 'Rename',
							icon: 'ic:baseline-edit',
							on_click: toggle_name_input
						},
						{
							label: 'Download',
							icon: 'ic:baseline-download',
							on_click: () => dispatch('download')
						},
						{
							label: 'Delete',
							icon: 'ic:outline-delete',
							is_danger: true,
							on_click: () => dispatch('delete')
						}
					]}
				/>
			</div>
		{/if}
	</header>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="symbol-container" class:disabled={component_error} bind:this={element} data-test-id="symbol-{symbol.id}">
		{#if component_error}
			<div class="error">
				<Icon icon="heroicons:no-symbol-16-solid" />
			</div>
		{:else if componentCode}
			<div class="symbol">
				{#key componentCode}
					<IFrame
						bind:height
						{append}
						componentCode={{
							...componentCode,
							head
						}}
					/>
				{/key}
			</div>
		{/if}
	</div>
</div>

<style lang="postcss">
	.sidebar-symbol {
		--IconButton-opacity: 0;

		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding-bottom: 0.5rem;
			color: #e7e7e7;
			transition: opacity 0.1s;
			gap: 1rem;

			.name {
				overflow: hidden;
				display: flex;
				align-items: center;
				gap: 0.25rem;
				font-size: 13px;
				line-height: 16px;

				h3 {
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}
			}

			.symbol-options {
				display: flex;
				align-items: center;
				color: #e7e7e7;
				gap: 3px;

				:global(svg) {
					height: 1rem;
					width: 1rem;
				}
			}
		}
	}
	.symbol-container {
		width: 100%;
		border-radius: 0.25rem;
		overflow: hidden;
		position: relative;
		cursor: grab;
		min-height: 2rem;
		transition: box-shadow 0.2s;
		background: var(--color-gray-8);

		&:after {
			content: '';
			position: absolute;
			inset: 0;
		}

		&.disabled {
			pointer-events: none;
		}
	}
	.error {
		display: flex;
		justify-content: center;
		height: 100%;
		position: absolute;
		inset: 0;
		align-items: center;
		/* background: #ff0000; */
	}
	[contenteditable] {
		outline: 0 !important;
	}
</style>
