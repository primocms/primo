<script>
	import Icon from '@iconify/svelte'
	import { onMount, createEventDispatcher } from 'svelte'
	import autosize from 'autosize'

	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {string | null} [id]
	 * @property {string | null} [label]
	 * @property {string} [prefix]
	 * @property {string} [prefix_icon]
	 * @property {any} value
	 * @property {string} [placeholder]
	 * @property {string} [variants]
	 * @property {string} [type]
	 * @property {boolean} [autofocus]
	 * @property {string} [selection]
	 * @property {boolean} [grow]
	 * @property {boolean} [disabled]
	 * @property {any} [options]
	 * @property {{ label: string, onclick?: function, type?: string, disabled?: boolean } | null} [button]
	 * @property {() => void} [oninput]?
	 * @property {() => void} [onblur]?
	 * @property {() => void} [onkeydown]?
	 * @property {() => void} [onfocus]?
	 */

	/** @type {Props} */
	let {
		id = null,
		label = null,
		prefix = '',
		prefix_icon = '',
		value = $bindable(),
		placeholder = '',
		variants = '',
		type = 'text',
		autofocus = false,
		selection = $bindable(''),
		grow = false,
		disabled = false,
		options = [],
		button = null,
		oninput = () => {},
		onblur = () => {},
		onkeydown = () => {},
		onfocus = () => {}
	} = $props()

	let element = $state()
	onMount(() => {
		if (element) {
			autosize(element)
		}
	})
</script>

<!-- svelte-ignore a11y_label_has_associated_control -->
<label class="TextInput {variants}" {id}>
	{#if label}<span class="primo--field-label">{label}</span>{/if}
	<div style="display: flex;width: 100%;gap: 0.5rem;">
		{#if options.length > 0}
			<select class="options" onchange={(e) => dispatch('select', { value: e?.target?.value })} bind:value={selection}>
				{#each options as option}
					<option value={option.value}>
						{option.label}
					</option>
				{/each}
			</select>
		{/if}
		<div class="input-container">
			{#if prefix}
				<span class="prefix">{prefix}</span>
			{:else if prefix_icon}
				<Icon icon={prefix_icon} />
			{/if}
			{#if grow}
				<textarea
					rows="1"
					bind:this={element}
					{value}
					{type}
					{placeholder}
					{autofocus}
					{disabled}
					{onfocus}
					oninput={({ target }) => {
						value = target.value
						oninput(value)
					}}
					{onblur}
					{onkeydown}
				></textarea>
			{:else}
				<input
					{value}
					{type}
					{placeholder}
					{autofocus}
					{disabled}
					{onfocus}
					oninput={({ target }) => {
						value = target.value
						// dispatch('input', value)
						oninput(value)
					}}
					onchange={({ target }) => {
						value = target.value
						// dispatch('input', value)
						oninput(value)
					}}
					{onblur}
					{onkeydown}
				/>
			{/if}
			{#if button}
				<button onclick={button.onclick} type={button.type} disabled={button.disabled}>
					{button.label}
				</button>
			{/if}
		</div>
	</div>
</label>

<style lang="postcss">
	.TextInput {
		display: flex;
		/* width: 100%; */
		flex: 1;
		flex-wrap: wrap;
		justify-content: flex-start;
		/* gap: 0.5rem; */
	}
	.options {
		display: flex;
		border-radius: 0.25rem;
		background: var(--color-gray-8);
		padding-inline: 0.5rem;

		option {
			font-size: 0.75rem;
			display: flex;
			align-items: center;
			gap: 0.25rem;
			padding: 1px 10px;

			&:not(:last-child) {
				border-right: 1px solid var(--color-gray-7);
			}
		}
	}
	label {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: flex-end;
		/* gap: 0.25rem; */
		color: var(--color-gray-2);
		margin-top: var(--TextInput-mt, 0);
		margin-bottom: var(--TextInput-mb, 0);
		margin-right: var(--TextInput-mr, 0);
		margin-left: var(--TextInput-ml, 0);
		width: 100%;

		span.primo--field-label {
			font-size: var(--TextInput-label-font-size, 0.75rem);
		}
	}

	.input-container {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		width: 100%;
		background: #1f1f1f; /* TODO: set to variable (this is nice inbetween color) */
		border: 1px solid var(--color-gray-8);
		color: var(--color-gray-2);
		font-weight: 400;
		border-radius: var(--input-border-radius);
		padding: 6px 8px;
		flex: 1;
		transition: 0.1s;

		&:has(input:focus) {
			border-color: var(--color-gray-7);
		}

		span.prefix {
			display: flex;
			align-items: center;
			margin-right: 1rem;
		}

		input,
		textarea {
			font-size: 0.875rem;
			flex: 1;
			background: transparent;
			width: 100%;

			&:focus {
				outline: 0;
			}

			&::placeholder {
				color: var(--color-gray-7);
			}
		}

		button {
			font-size: 0.75rem;
			background: var(--color-gray-9);
			padding: 3px 8px;
			border-radius: var(--primo-border-radius);
			transition: 0.1s;

			&[disabled] {
				opacity: 0.5;
				cursor: initial;
			}
		}
	}
</style>
