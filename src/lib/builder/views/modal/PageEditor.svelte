<script>
	import Icon from '@iconify/svelte'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import Fields from '$lib/builder/components/Fields/FieldsContent.svelte'
	import _, { chain as _chain } from 'lodash-es'
	import ModalHeader from './ModalHeader.svelte'
	import CodeEditor from '$lib/builder/components/CodeEditor/CodeMirror.svelte'
	import modal from '$lib/builder/stores/app/modal'
	import page_types, { update_page_type } from '$lib/builder/actions/page_types'
	import page_type from '$lib/builder/stores/data/page_type'

	let local_code = $state(_.cloneDeep($page_type.code))
	let local_fields = $state(_.cloneDeep($page_type.fields))
	let local_entries = $state(_.cloneDeep($page_type.entries))

	let disableSave = false

	async function saveComponent() {
		page_types.update($page_type.id, { code: local_code })
		update_page_type({
			entries: local_entries,
			fields: local_fields
		})
		modal.hide()
	}
</script>

<ModalHeader
	icon={$page_type.icon}
	title={$page_type.name}
	warn={() => {
		return true
	}}
	button={{
		icon: 'material-symbols:save',
		label: 'Save',
		onclick: saveComponent,
		disabled: disableSave
	}}
/>

<main class="SiteEditor">
	<PaneGroup direction="horizontal" style="display: flex;">
		<Pane defaultSize={50}>
			<Fields
				id="page-type-{$page_type.id}"
				fields={local_fields}
				entries={local_entries}
				on:input={({ detail }) => {
					local_fields = detail.fields
					local_entries = detail.entries
				}}
			/>
		</Pane>
		<PaneResizer class="PaneResizer-primary">
			<div class="icon primary">
				<Icon icon="mdi:drag-vertical-variant" />
			</div>
		</PaneResizer>
		<Pane defaultSize={50}>
			<PaneGroup direction="vertical">
				<Pane>
					<div class="container" style="margin-bottom: 1rem">
						<span class="primo--field-label">Head</span>
						<CodeEditor mode="html" bind:value={local_code.head} on:save={saveComponent} />
					</div>
				</Pane>
				<PaneResizer class="PaneResizer-secondary">
					<div class="icon secondary">
						<Icon icon="mdi:drag-horizontal-variant" />
					</div>
				</PaneResizer>
				<Pane>
					<div class="container">
						<span class="primo--field-label">Foot</span>
						<CodeEditor mode="html" bind:value={local_code.foot} on:save={saveComponent} />
					</div>
				</Pane>
			</PaneGroup>
		</Pane>
	</PaneGroup>
</main>

<style lang="postcss">
	.SiteEditor {
	}
	main {
		display: flex; /* to help w/ positioning child items in code view */
		background: var(--primo-color-black);
		color: var(--color-gray-2);
		padding: 0 0.5rem;
		flex: 1;
		overflow: hidden;

		--Button-bg: var(--color-gray-8);
		--Button-bg-hover: var(--color-gray-9);
	}

	:global(.PaneResizer-primary) {
		height: 100%;
		width: 3px;
		background: var(--color-gray-9);
		display: grid;
		place-content: center;
	}
	:global(.PaneResizer-secondary) {
		width: 100%;
		display: grid;
		place-content: center;
		justify-content: center;
		height: 2px;
		background: var(--color-gray-8);
		margin-block: 0.5rem;
	}
	.icon {
		position: relative;
		background: var(--color-gray-8);
		border-radius: 2px;
		color: var(--color-gray-3);

		&.primary {
			padding-block: 3px;
		}

		&.secondary {
			padding-inline: 3px;
		}
	}
	.container {
		padding-left: 0.75rem;
		display: flex;
		flex-direction: column;
		max-height: 100%;
	}
</style>
