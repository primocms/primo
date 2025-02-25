<script>
	import Icon from '@iconify/svelte'
	import { PaneGroup, Pane, PaneResizer } from 'paneforge'
	import Fields from '$lib/builder/components/Fields/FieldsContent.svelte'
	import _, { chain as _chain } from 'lodash-es'
	import ModalHeader from '../ModalHeader.svelte'
	import CodeEditor from '$lib/builder/components/CodeEditor/CodeMirror.svelte'
	import modal from '$lib/builder/stores/app/modal'
	import { update_site_code_and_content } from '$lib/builder/actions/active_site'
	import site from '$lib/builder/stores/data/site'
	import { userRole } from '$lib/builder/stores/app/misc'
	import { setContext } from 'svelte'

	setContext('hide_dynamic_field_types', true)

	let local_code = $state(_.cloneDeep($site.code))
	let local_fields = $state(_.cloneDeep($site.fields))
	let local_content = $state(_.cloneDeep($site.entries))

	let disableSave = false

	async function saveComponent() {
		update_site_code_and_content({
			entries: local_content,
			fields: local_fields,
			code: local_code
		})
		modal.hide()
	}
</script>

<ModalHeader
	icon="gg:website"
	title="Site"
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
	{#if $userRole === 'DEV'}
		<PaneGroup direction="horizontal" style="display: flex;">
			<Pane defaultSize={50}>
				<Fields
					id="site-{site.id}"
					fields={local_fields}
					entries={local_content}
					on:input={({ detail }) => {
						local_fields = detail.fields
						local_content = detail.entries
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
	{:else}
		<Fields
			id="site-{site.id}"
			fields={local_fields}
			entries={local_content}
			on:input={({ detail }) => {
				local_fields = detail.fields
				local_content = detail.entries
			}}
		/>
	{/if}
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
