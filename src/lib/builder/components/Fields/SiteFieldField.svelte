<script>
	import UI from '../../ui/index.js'
	import site from '../../stores/data/site.js'
	import fieldTypes from '../../stores/app/fieldTypes.js'

	let { field, oninput = /** @type {(val: any) => void} */ () => {} } = $props()

	// fetch fields for site and current page
	let field_list = $site.fields.filter((f) => !f.parent).sort((a, b) => a.index - b.index)
</script>

<div class="PageFieldField">
	<div class="container">
		<!-- Field select -->
		<UI.Select
			fullwidth={true}
			on:input={({ detail }) => oninput(detail)}
			label="Site Field"
			value={field.source}
			options={field_list.map((f) => ({
				label: f.label,
				value: f.id,
				icon: $fieldTypes.find((ft) => ft.id === f.type).icon
			}))}
		/>
	</div>
</div>

<style>
	.container {
		display: grid;
	}
</style>
