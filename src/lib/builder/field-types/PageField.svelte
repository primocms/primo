<script>
	import pages from '../stores/data/pages.js'
	import page_types from '../stores/data/page_types.js'
	import UI from '../ui/index.js'

	const { field, value, oninput = /** @type {(val: string) => void} */ () => {} } = $props()

	const page_type = $derived($page_types.find((pt) => pt.id === field.options.page_type))
	const selectable_pages = $derived($pages.filter((p) => p.page_type === field.options.page_type))

	$inspect({ value, page_type, selectable_pages })
</script>

<div>
	<UI.Select
		icon={page_type.icon}
		label={field.label}
		{value}
		options={selectable_pages.map((page) => ({
			value: page.id,
			label: page.name
		}))}
		on:input={({ detail }) => {
			oninput({ value: detail })
		}}
		fullwidth={true}
	/>
</div>

<style lang="postcss">
	div {
		width: 100%;
	}
</style>
