<script>
	import UI from '../ui'

	let { field, value = false, oninput = /** @type {(val: boolean) => void} */ () => {} } = $props()
</script>

<div>
	<UI.Switch label={field.label} {field} {value} oninput={(value) => oninput({ value })} />
</div>

<style lang="postcss">
	div {
		width: 100%;
	}
</style>
