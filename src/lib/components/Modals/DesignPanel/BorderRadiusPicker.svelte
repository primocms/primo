<script>
	import { createEventDispatcher } from 'svelte'

	const dispatch = createEventDispatcher()

	let { label, value, oninput } = $props()
</script>

<label>
	<span>{label}</span>
	<input
		data-target-id="design-shadow-range"
		type="range"
		min="0"
		max="30"
		step="2"
		value={value.slice(0, -2)}
		oninput={({ target }) => {
			console.log({ target })
			value = `${target.value}px`
			dispatch('input')
			oninput(value)
		}}
	/>
	<span>{value}</span>
</label>

<style lang="postcss">
	span {
		font-size: var(--label-font-size, 1rem);
		font-weight: var(--label-font-weight, 700);
		margin-bottom: 0.5rem;
	}
	label {
		display: grid;
	}
</style>
