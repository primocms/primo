<script lang="ts">
	import './catalog-cards.css'
	import IFrame from '$lib/builder/components/IFrame.svelte'
	import { LibrarySymbols } from '$lib/pocketbase/collections'
	import { block_html } from '$lib/builder/code_generators'
	import type { Snippet } from 'svelte'
	import { locale } from '$lib/builder/stores/app'
	import type { ObjectOf } from '$lib/pocketbase/CollectionMapping.svelte'
	import { useContent } from '$lib/Content.svelte'
	import * as _ from 'lodash-es'

	/** @type {Props} */
	let {
		symbol,
		onclick,
		children = null,
		show_price = false
	}: {
		symbol: ObjectOf<typeof LibrarySymbols>
		onclick?: () => void
		children?: null | Snippet
		show_price?: boolean
	} = $props()

	const code = $derived(
		symbol && {
			html: symbol.html,
			css: symbol.css,
			js: symbol.js
		}
	)
	const _data = $derived(useContent(symbol, { target: 'cms' }))
	const data = $derived(_data && (_data[$locale] ?? {}))

	let last_input: object
	let generated_code = $state()
	$effect(() => {
		if (!code || !data) {
			return
		}

		// Skip recompilation if data is effectively unchanged
		const input = { code, data }
		if (_.isEqual(last_input, input)) return
		last_input = _.cloneDeep(input)

		block_html(input)
			.then((res) => {
				generated_code = res
			})
			.catch((error) => {
				console.error('Failed to generate symbol preview:', error)
			})
	})

	const showing_footer = $derived(symbol?.name || children || show_price)
</script>

<div class="catalog-card">
	<button {onclick} class="catalog-preview" aria-label={symbol?.name || 'Block preview'}>
		<IFrame componentCode={generated_code} />
	</button>
	{#if showing_footer}
		<div class="catalog-footer">
			<div class="catalog-identity">
				{#if symbol?.name}
					<div class="catalog-name" title={symbol.name}>{symbol?.name}</div>
				{/if}
				{#if show_price}
					<div class="catalog-price">Free</div>
				{/if}
			</div>
			{#if children}
				<div>
					{@render children()}
				</div>
			{/if}
		</div>
	{/if}
</div>
