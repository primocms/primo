<script>
	import { createEventDispatcher } from 'svelte'
	import ColorPicker, { A11yVariant } from 'svelte-awesome-color-picker'

	const dispatch = createEventDispatcher()

	let { label, value, oninput } = $props()

	let color = $state()
</script>

<div class="ColorPicker" data-test-id={label}>
	<span>{label}</span>
	{#if label === 'Accent Color'}
		<ColorPicker
			label=""
			hex={value || '#f6f0dc'}
			bind:color
			isAlpha
			on:input={(event) => {
				// historyHex = [...historyHex, event.detail.hex];
				value = event.detail.hex
				dispatch('input')
				oninput(event.detail.hex)
			}}
		/>
	{:else}
		<ColorPicker
			label=""
			components={A11yVariant}
			hex={value}
			bind:color
			isAlpha
			a11yColors={[
				// { textHex: '#222', reverse: true, placeholder: 'background' },
				// { textHex: '#222', bgHex: '#FF0000', reverse: true, placeholder: 'background' },
				// { bgHex: '#FFF', textHex: '#222', reverse: true, placeholder: 'text', size: 'large' },
				{ bgHex: '#7F7F7F', textHex: '#FFF', reverse: true, placeholder: 'button' }
			]}
			on:input={(event) => {
				// historyHex = [...historyHex, event.detail.hex];
				value = event.detail.hex
				dispatch('input')
				oninput(event.detail.hex)
			}}
		/>
	{/if}

	<!-- <input type="color" bind:value on:input /> -->
</div>

<style lang="postcss">
	.ColorPicker {
		display: grid;
		gap: 0.5rem;
		justify-self: flex-start;
		--cp-bg-color: #333;
		--cp-border-color: white;
		--cp-text-color: white;
		--cp-input-color: #555;
		--cp-button-hover-color: #777;
		span {
			font-size: var(--label-font-size, 1rem);
			font-weight: var(--label-font-weight, 700);
		}
	}
</style>
