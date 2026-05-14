<script lang="ts">
	import * as _ from 'lodash-es'
	import Icon from '@iconify/svelte'
	import UI from '../ui'
	import { watch } from 'runed'
	import type { FieldValueHandler } from '../components/Fields/FieldsContent.svelte'
	import { site_context } from '$lib/builder/stores/context'
	import type { Field } from '$lib/common/models/Field'

	const { field, entry: passedEntry, onchange }: { field: Field; entry?: any; onchange: FieldValueHandler } = $props()

	const default_value = {
		label: '',
		url: '',
		page: null
	}

	const default_entry = { value: default_value }

	const { value: site } = site_context.getOr({ value: null })
	const entry = $derived(passedEntry || default_entry)
	const all_pages = $derived(site?.pages() ?? [])

	// Build hierarchical page list with visual indicators for subpages
	const selectable_pages = $derived.by(() => {
		if (!all_pages.length) return []

		const homepage = site?.homepage()
		if (!homepage) return all_pages.sort((a, b) => a.index - b.index)

		const result = []

		function add_descendants(page, depth = 0) {
			const arrows = depth > 0 ? '↳ '.repeat(depth) : ''
			result.push({
				...page,
				label: `${arrows}${page.name}`,
				value: page.id
			})

			// Get and sort children
			const children = all_pages
				.filter(p => p.parent === page.id)
				.sort((a, b) => a.index - b.index)

			for (const child of children) {
				add_descendants(child, depth + 1)
			}
		}

		// Add homepage (no arrow)
		result.push({
			...homepage,
			label: homepage.name,
			value: homepage.id
		})

		// Get homepage's direct children (same level as homepage, no arrows)
		const top_level_children = all_pages
			.filter(p => p.parent === homepage.id)
			.sort((a, b) => a.index - b.index)

		// For each top-level child, add it and its descendants
		for (const child of top_level_children) {
			result.push({
				...child,
				label: child.name,
				value: child.id
			})

			// Add this child's descendants with arrows
			const grandchildren = all_pages
				.filter(p => p.parent === child.id)
				.sort((a, b) => a.index - b.index)

			for (const grandchild of grandchildren) {
				add_descendants(grandchild, 1)
			}
		}

		return result
	})

	// Auto-select first page on open
	let auto_selected_page = $state(false)
	watch(
		() => selectable_pages,
		() => {
			const top_page = selectable_pages[0]
			if (!top_page || auto_selected_page) return

			const has_url = entry?.value?.url
			const has_page = entry?.value?.page
			if (!has_url && !has_page && selected === 'page') {
				onchange({ [field.key]: { 0: { value: { ...entry.value, page: top_page.id } } } })
				auto_selected_page = true
			}
		}
	)

	let selected = $derived<'page' | 'url'>(entry?.value?.url ? 'url' : 'page')
</script>

<div class="Link">
	<div class="inputs">
		<UI.TextInput
			label={field.label}
			oninput={(text) => {
				onchange({ [field.key]: { 0: { value: { ...entry.value, label: text } } } })
			}}
			value={entry.value.label}
			id="page-label"
			placeholder="About Us"
		/>
		<div class="url-select">
			<div class="toggle">
				<button class:active={selected === 'page'} onclick={() => (selected = 'page')} type="button">
					<Icon icon="iconoir:multiple-pages" />
					<span>Page</span>
				</button>
				<button class:active={selected === 'url'} onclick={() => (selected = 'url')} type="button">
					<Icon icon="akar-icons:link-chain" />
					<span>URL</span>
				</button>
			</div>
			{#if selected === 'page'}
				<UI.Select
					fullwidth={true}
					value={entry.value.page}
					options={selectable_pages}
					on:input={({ detail: pageId }) => {
						const page = all_pages.find((p) => p.id === pageId)
						if (page) {
							onchange({ [field.key]: { 0: { value: { ...entry.value, page: page.id, url: undefined } } } })
						}
					}}
				/>
			{:else}
				<UI.TextInput
					oninput={(text) => {
						onchange({ [field.key]: { 0: { value: { ...entry.value, url: text, page: undefined } } } })
					}}
					onblur={() => {
						// auto-set https protocol only if no protocol exists and it's not a relative URL
						const text = entry.value.url
						if (!text) return
						const has_protocol = text.includes('://')
						const is_relative = text.startsWith('/') || text.startsWith('#')
						if (!has_protocol && !is_relative) {
							const url_with_protocol = `https://${text}`
							onchange({ [field.key]: { 0: { value: { ...entry.value, url: url_with_protocol, page: undefined } } } })
						}
					}}
					value={entry.value.url}
					type="url"
					placeholder="https://example.com"
				/>
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	.Link {
		display: flex;
		flex-direction: column;
	}

	.toggle {
		display: flex;
		background: var(--color-gray-9);
		border: 1px solid var(--color-gray-8);
		padding: 2px;
		border-radius: var(--primo-border-radius);
		--Dropdown-font-size: 0.875rem;

		button {
			border-radius: var(--primo-border-radius);
			font-size: 0.875rem;
			flex: 1;
			background: var(--color-gray-8);
			color: #8a8c8e;
			padding: 0.25rem 0.5rem;
			font-weight: 500;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.5rem;
			transition: 0.1s;
			background: transparent;

			&:focus,
			&.active {
				color: white;
				background: var(--color-gray-8);
				/* z-index: 1; */
			}
		}
	}

	.inputs {
		display: grid;
		gap: 0.5rem;
		width: 100%;

		.url-select {
			display: flex;
			gap: 0.25rem;
			flex-wrap: wrap;
		}
	}
</style>
