<script>
	import UI from '../ui'

	let { field, value, oninput = /** @type {(val: string) => void} */ () => {} } = $props()
</script>

<div>
	<UI.TextInput {...field} {value} oninput={(text) => oninput({ value: text })} type="number" />
</div>

<style lang="postcss">
	div {
		width: 100%;
	}
</style>
