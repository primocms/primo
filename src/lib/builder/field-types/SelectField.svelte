<script>
	import UI from '../ui'
	import { tick } from 'svelte'

	let { field = $bindable(), value, oninput = /** @type {(val: any) => void} */ () => {} } = $props()

	if (!field?.options?.options) {
		field.options = {
			options: []
		}
	}

	// input doesn't fire immediately for some reason
	tick().then(() => {
		if (!value) {
			oninput({ value: field.options.options[0]?.value })
		}
	})

	let options = $derived(field.options.options)
</script>

<div class="SelectField">
	{#if options.length > 0}
		<UI.Select fullwidth={true} label={field.label} {options} {value} on:input={({ detail }) => oninput({ value: detail })} />
	{:else}
		<span>This field doesn't have any options</span>
	{/if}
</div>

<style lang="postcss">
	.SelectField {
		width: 100%;
	}
</style>
