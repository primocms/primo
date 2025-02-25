<script lang="ts">
	import SitePreview from '$lib/components/SitePreview.svelte'
	import { CheckCircle } from 'lucide-svelte'
	import { find as _find } from 'lodash-es'
	import type { MouseEventHandler } from 'svelte/elements'

	/**
	 * @typedef {Object} Props
	 * @property {import('$lib').Site} site
	 * @property {boolean} selected
	 * @property {any} [preview]
	 * @property {string} [append]
	 * @property {string} [style]
	 * @property {any} [src]
	 * @property {MouseEventHandler<HTMLButtonElement> } [onclick]
	 */

	/** @type {Props} */
	let { site, selected, preview = $bindable(null), append = '', style = '', src = null, onclick } = $props()
</script>

<button class="relative overflow-hidden rounded w-full" {onclick} type="button">
	{#if selected}
		<div class="absolute inset-0 z-20 bg-black/50 flex items-center justify-center">
			<CheckCircle size={32} class="text-white" />
		</div>
	{/if}
	<SitePreview {preview} {append} />
	<div class="absolute bottom-0 w-full px-3 py-2 z-30 bg-gray-900 bg-opacity-50 backdrop-blur-sm text-left">
		<span class="text-sm font-medium leading-none">{site.name}</span>
	</div>
</button>
