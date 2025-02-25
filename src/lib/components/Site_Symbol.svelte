<script>
	import { fade } from 'svelte/transition'
	import _ from 'lodash-es'
	import Icon from '@iconify/svelte'
	import { processCode } from '$lib/builder/utils'
	import * as Components from '$lib/builder/components'

	/**
	 * @typedef {Object} Props
	 * @property {any} symbol
	 * @property {any} site
	 * @property {string} [append]
	 * @property {boolean} [checked]
	 * @property {function} onclick
	 * @property {function} onmousedown
	 * @property {function} onmouseup
	 */

	/** @type {Props} */
	let { symbol = $bindable(), site, append = '', checked = false, onclick, onmousedown, onmouseup } = $props()

	let name_el

	let renaming = false
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

		let res = await processCode({
			component: {
				head: site.code.head,
				css: symbol.code.css,
				html: symbol.code.html,
				data: symbol.entries[language]
			},
			buildStatic: true,
			hydrated: true
		})
		if (res.error) {
			component_error = res.error
		} else {
			component_error = null
			res.css = res.css
			componentCode = res
			cachedSymbol = _.cloneDeep({ code: symbol.code, entries: symbol.entries })
		}
	}
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
	$effect.pre(() => {
		compile_component_code(symbol, 'en')
	})
</script>

<button class="sidebar-symbol" {onclick}>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="symbol" {onmousedown} {onmouseup}>
		{#if checked}
			<div class="check" in:fade={{ duration: 100 }}>
				<Icon icon="material-symbols:check" />
			</div>
		{/if}
		{#if component_error}
			<div class="error">
				<Icon icon="bxs:error" />
			</div>
		{:else}
			{#key componentCode}
				<Components.IFrame bind:height {append} {componentCode} />
			{/key}
		{/if}
	</div>
</button>

<style lang="postcss">
	.sidebar-symbol {
		width: 100%;
		--IconButton-opacity: 0;

		&:hover:not(.dragging) {
			--IconButton-opacity: 1;
		}

		.symbol {
			width: 100%;
			border-radius: 0.25rem;
			overflow: hidden;
			position: relative;
			min-height: 2rem;
			transition: box-shadow 0.2s;
			border: 1px solid var(--color-gray-8);
		}
	}
	.check {
		position: absolute;
		inset: 0;
		z-index: 9;
		background: rgba(0, 0, 0, 0.9);
		font-size: 3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--weave-primary-color);
	}
	.error {
		display: flex;
		justify-content: center;
		height: 100%;
		position: absolute;
		inset: 0;
		align-items: center;
		background: #ff0000;
	}
</style>
