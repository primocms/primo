<script>
	let { field, value, oninput = /** @type {(val: string) => void} */ () => {} } = $props()
</script>

<div>
	<p class="label">{field.label}</p>
	<div class="container">
		<p class="value">{value}</p>
		<input oninput={({ target }) => oninput(target.value)} class="input" {value} type="range" />
	</div>
</div>

<style lang="postcss">
	div {
		width: 100%;
	}
	.label {
		font-size: 0.875rem;
		margin-bottom: 0.5rem;
		font-weight: 500;
	}
	.container {
		display: flex;
		gap: 0.5rem;
	}
	.value {
		font-size: 0.875rem;
		font-weight: 500;
	}

	input {
		outline-color: var(--weave-primary-color);
		background: var(--primo-color-black);
		padding: 0.5rem;
		border-bottom: 2px solid rgb(245, 245, 245);
		width: var(--Slider-width);
	}
</style>
