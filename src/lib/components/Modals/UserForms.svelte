<script>
	import file_saver from 'file-saver'
	import { fade } from 'svelte/transition'
	import Icon from '@iconify/svelte'
	import Checkout from '$lib/stripe/Checkout.svelte'
	import EmailInvoice from '$lib/stripe/EmailInvoice.svelte'
	import * as timeago from 'timeago.js'
	import Button from '$lib/builder/ui/Button.svelte'
	import UI from '$lib/builder/ui'
	import RepeaterField from '$lib/builder/field-types/RepeaterField.svelte'
	import { page } from '$app/stores'
	import { v4 as uuidv4 } from 'uuid'
	import _, { cloneDeep, chain as _chain } from 'lodash-es'
	import { dataChanged } from '$lib/builder/database'
	import { invalidate } from '$app/navigation'
	import { PUBLIC_VITE_DEV } from '$env/static/public'
	import ModalHeader from '$lib/components/ModalHeader.svelte'

	let forms = $state(null)
	dataChanged({
		table: 'forms',
		action: 'select',
		data: 'button, error_message, success_message, name, id, fields, submissions:form_submissions(*), recipients',
		match: {
			site: $page.data.site.id
		}
	}).then((res) => {
		forms = cloneDeep(res)
	})

	let current_step = $state(localStorage.getItem('UserForms.current_step') || 'forms')
	function set_current_step(step) {
		localStorage.setItem('UserForms.current_step', step)
		current_step = step
	}

	const FormItem = (form) => ({
		id: uuidv4(),
		button: form.button || '',
		fields: form.fields || [],
		name: form.name || '',
		success_message: form.success_message || '',
		error_message: form.error_message || '',
		site: $page.data.site.id
	})

	let creating_form = $state(false)

	let new_form_name = $state('')
	let new_form_button = ''
	let new_form_success_message = ''
	let new_form_error_message = ''

	let field = $state({
		label: 'Form Inputs',
		key: 'form-inputs',
		value: [],
		fields: [
			{
				key: 'label',
				type: 'text',
				label: 'Field Label',
				fields: [],
				value: ''
			},
			{
				key: 'type',
				type: 'select',
				label: 'Type',
				fields: [],
				value: 'text',
				options: {
					selected: 'text',
					options: [
						{
							value: 'text',
							label: 'Text'
						},
						{
							value: 'textarea',
							label: 'Text Area'
						},
						{
							value: 'number',
							label: 'Number'
						},
						{
							value: 'tel',
							label: 'Phone Number'
						},
						{
							value: 'email',
							label: 'Email'
						},
						{
							value: 'url',
							label: 'URL'
						},
						{
							value: 'date',
							label: 'Date'
						}
					]
				}
			},
			{
				key: 'placeholder',
				type: 'text',
				label: 'Placeholder',
				fields: [],
				value: ''
			}
		]
	})

	async function download_csv(form) {
		const rows = form.submissions.map((submission) => ({
			id: submission.id,
			...submission.data,
			created_at: submission.created_at
		}))

		const csvData = objectToCSV(rows)
		const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
		file_saver.saveAs(blob, `${form.name} submissions.csv`)

		function objectToCSV(array) {
			const csvRows = []
			const headers = Object.keys(array[0])
			csvRows.push(headers.join(',')) // Add the headers row

			for (const row of array) {
				const values = headers.map((header) => {
					const escaped = ('' + row[header]).replace(/"/g, '\\"') // Escape double quotes
					return `"${escaped}"`
				})
				csvRows.push(values.join(','))
			}

			return csvRows.join('\n')
		}
	}

	async function create_form() {
		const new_item = FormItem({
			name: new_form_name,
			button: new_form_button,
			fields: cloneDeep(field.value),
			success_message: new_form_success_message,
			error_message: new_form_error_message
		})
		forms = [...forms, new_item]
		await dataChanged({
			table: 'forms',
			action: 'insert',
			data: new_item
		})
		creating_form = false
		new_form_name = ''
		new_form_button = ''
		field.fields = []
		new_form_success_message = ''
		new_form_error_message = ''
	}

	async function update_form() {
		forms = forms.map((form) => (form.id === form_being_modified.id ? cloneDeep(form_being_modified) : form))

		await dataChanged({
			table: 'forms',
			action: 'update',
			id: form_being_modified.id,
			data: {
				name: form_being_modified.name,
				fields: form_being_modified.fields,
				recipients: form_being_modified.recipients
			}
		})

		delete form_being_modified.submissions
		// updates section and symbol content where form
		await $page.data.supabase.rpc('update_form_content', { target_id: form_being_modified.id, new_form_value: form_being_modified })

		// TODO:
		// - function should recursively search symbol 'fields' column (for nested forms)
		// - should work with multiple forms (should already work, just double check)

		invalidate('app:data')
		form_being_modified = null
	}

	async function delete_form(form_id) {
		await dataChanged({
			table: 'forms',
			action: 'delete',
			id: form_id
		})
		forms = forms.filter((form) => form.id !== form_id)
	}

	let form_being_modified = $state(null)
</script>

<ModalHeader>
	{#snippet title()}
		<div class="tabs">
			{#if ['forms', 'submissions'].includes(current_step)}
				<button class:active={current_step === 'forms'} onclick={() => set_current_step('forms')}>
					<Icon icon="fluent:form-multiple-48-filled" />
					<span>Forms</span>
				</button>
				<button class:active={current_step === 'submissions'} onclick={() => set_current_step('submissions')}>
					<Icon icon="fa6-solid:paper-plane" />
					<span>Submissions</span>
				</button>
			{/if}
		</div>
	{/snippet}
</ModalHeader>

<main>
	{#if current_step === 'checkout'}
		<div
			style="max-height: 80vh; flex:1; background: var(--color-gray-9);
overflow: scroll"
		>
			<Checkout
				price_id={PUBLIC_VITE_DEV ? 'price_1OmiV3AELMGfXjn7fcu4INN6' : 'price_1OpwysAELMGfXjn7y0dNBah2'}
				metadata={{
					subscription: 'FORMS',
					uid: $page.data.user.id,
					site_id: $page.data.site.id
				}}
			/>
		</div>
	{:else if current_step === 'email_invoice'}
		<div style="padding: 1rem 1.5rem">
			<EmailInvoice
				price_id={PUBLIC_VITE_DEV ? 'price_1OmiV3AELMGfXjn7fcu4INN6' : 'price_1OpwysAELMGfXjn7y0dNBah2'}
				metadata={{
					subscription: 'FORMS',
					uid: $page.data.user.id,
					site_id: $page.data.site.id
				}}
			/>
		</div>
	{:else if current_step === 'forms'}
		<div class="forms">
			{#if forms}
				<ul class="form-list">
					{#each forms as form}
						{#if form_being_modified?.id === form.id}
							<div class="form" in:fade={{ duration: 100 }}>
								<UI.TextInput bind:value={form_being_modified.name} label="Form Name" />
								<!-- <TextInput bind:value={new_form_button} label="Button Label" /> -->
								<!-- <TextInput bind:value={new_form_success_message} label="Success Message" /> -->
								<!-- <TextInput bind:value={new_form_error_message} label="Error Message" /> -->
								<RepeaterField
									show_label={true}
									field={{
										...field,
										label: 'Form Fields',
										value: form.fields
									}}
									on:input={({ detail }) => {
										form_being_modified.fields = detail.value
									}}
								/>
								<RepeaterField
									show_label={true}
									field={{
										fields: [
											{
												key: 'email',
												type: 'text',
												label: 'Email Address',
												fields: [],
												value: ''
											}
										],
										value: form.recipients.map((email) => ({ email })) || [],
										key: 'recipient',
										type: 'text',
										label: 'Recipients'
									}}
									on:input={({ detail }) => {
										form_being_modified.recipients = detail.value.map((item) => item.email)
									}}
									hidden_keys={['id']}
								/>
								<button disabled={false} style="display: flex;align-items: center;justify-content: center;gap: 0.25rem;" onclick={update_form}>
									<span>Update Form</span>
									<Icon icon="akar-icons:check" />
								</button>
							</div>
						{:else}
							<li>
								<UI.ListItem
									title={form.name}
									subtitle="{form.fields?.length} Fields"
									children={form.fields.map((field) => ({
										title: field.label,
										subtitle: field.type
									}))}
									popup_menu={[
										{
											on_click: () => {
												form_being_modified = cloneDeep(form)
											},
											icon: 'uil:edit',
											label: 'Edit'
										},
										{
											on_click: () => delete_form(form.id),
											icon: 'material-symbols:delete',
											label: 'Delete'
										}
									]}
								/>
							</li>
						{/if}
					{/each}
				</ul>
			{/if}
			{#if creating_form}
				<div class="form" in:fade={{ duration: 100 }}>
					<UI.TextInput autofocus={true} bind:value={new_form_name} label="Form Name" />
					<!-- <TextInput bind:value={new_form_button} label="Button Label" /> -->
					<!-- <TextInput bind:value={new_form_success_message} label="Success Message" /> -->
					<!-- <TextInput bind:value={new_form_error_message} label="Error Message" /> -->
					{#if forms}
						<RepeaterField bind:field hidden_keys={['id']} />
					{/if}
					<button disabled={false} style="display: flex;align-items: center;justify-content: center;gap: 0.25rem;" onclick={create_form}>
						<span>Create Form</span>
						<Icon icon="akar-icons:check" />
					</button>
				</div>
			{:else if !form_being_modified}
				<Button
					disabled={false}
					onclick={() => {
						creating_form = true
					}}
					label="New Form"
					icon="akar-icons:plus"
				/>
			{/if}
		</div>
	{:else if current_step === 'submissions'}
		<div class="submissions">
			{#if forms?.length > 0}
				<ul class="form-list">
					{#each forms as form}
						<li>
							<UI.ListItem
								title={form.name}
								subtitle="{form.fields?.length} Fields"
								children={form.submissions?.map((submission) => ({
									title: Object.entries(submission.data)[0][1],
									subtitle: timeago.format(submission.created_at),
									children: Object.entries(submission.data).map(([key, value]) => ({
										title: value,
										subtitle: key
									})),
									popup_menu: [
										{
											icon: 'fluent:delete-20-filled',
											label: 'Delete',
											on_click: async () => {
												const res = await dataChanged({
													table: 'form_submissions',
													action: 'delete',
													match: { id: submission.id }
												})
												const submissions_sans_item = form.submissions?.filter((s) => s.id !== submission.id)
												forms = forms.map((f) => (f.id === form.id ? { ...f, submissions: submissions_sans_item } : f))
											}
										}
									]
								}))}
								popup_menu={[
									{
										on_click: () => {
											download_csv(form)
										},
										label: 'Download as CSV',
										icon: 'material-symbols:download'
									}
								]}
							/>
						</li>
					{/each}
				</ul>
			{:else}
				<div
					style="
		padding: 1rem;
		padding-top: 0;
		display: grid;
		 gap: 1rem;"
				>
					<p>This is where you'll be able to view your form submissions.</p>
				</div>
			{/if}
		</div>
	{/if}
</main>

<style lang="postcss">
	main {
		width: 100%;
		background: var(--primo-color-black);
		color: var(--color-gray-2);
		padding: 0.5rem 0.5rem;
		flex: 1;
		overflow: auto;
		display: flex;
		flex-direction: column;
		/* gap: 1rem; */

		--Button-bg: var(--color-gray-8);
		--Button-bg-hover: var(--color-gray-9);
	}
	.tabs {
		display: flex;
		justify-content: center;
		color: white;

		button {
			font-size: 0.875rem;
			padding: 0.75rem 1rem;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			border-bottom: 1px solid #222;
			transition: 0.1s;

			&.active {
				border-bottom-color: var(--primo-color-brand);
			}
		}
	}
	ul.form-list {
		display: grid;
		gap: 0.5rem;
		color: var(--primo-color-white);

		margin-bottom: 1rem;

		li {
			/* overflow: hidden; */
		}
	}
	div.form {
		padding: 0.25rem;
		display: grid;
		gap: 1.5rem;
		padding: 0.825rem 1.125rem;
		align-items: flex-end;
		background: #1a1a1a;
		--TextInput-label-font-size: 0.75rem;

		button {
			border: 1px solid var(--primo-color-brand);
			border-radius: 0.25rem;
			padding: 9px 0.75rem;

			&:disabled {
				opacity: 20%;
			}
		}
	}
</style>
