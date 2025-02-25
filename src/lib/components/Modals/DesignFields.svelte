<script>
	import * as constants from '$lib/builder/constants'
	import FontPicker from './DesignPanel/FontPicker.svelte'
	import ColorPicker from './DesignPanel/ColorPicker.svelte'
	import BorderRadiusPicker from './DesignPanel/BorderRadiusPicker.svelte'
	import ShadowPicker from './DesignPanel/ShadowPicker.svelte'

	let { values, oninput } = $props()
</script>

<div class="DesignFields">
	{#each Object.entries(constants.design_tokens) as [token, { label, type }], i}
		{#if type === 'font-family'}
			<FontPicker {label} value={values[token]} oninput={(val) => oninput(token, val)} />
		{:else if type === 'color'}
			<ColorPicker {label} value={values[token]} oninput={(val) => oninput(token, val)} />
		{:else if type === 'border-radius'}
			<BorderRadiusPicker {label} value={values[token]} oninput={(val) => oninput(token, val)} />
		{:else if type === 'box-shadow'}
			<ShadowPicker {label} value={values[token]} oninput={(val) => oninput(token, val)} />
		{/if}
		{#if i !== Object.entries(constants.design_tokens).length - 1}
			<hr style="border-color: #222; margin: 1rem 0;" />
		{/if}
	{/each}
</div>

<style>
	.DesignFields {
		width: 100%;
		display: grid;
		padding-bottom: 1.5rem;
		--label-font-size: 0.875rem;
		--label-font-weight: 500;
		padding: 0 0.5rem;
	}
</style>
