<script>
	import { v4 as uuid } from 'uuid'
	import { createEventDispatcher } from 'svelte'
	import { fade } from 'svelte/transition'
	import UI from '../../../../ui/index.js'
	import Icon from '@iconify/svelte'
	import IconPicker from '../../../../components/IconPicker.svelte'
	import { clickOutside } from '../../../../utilities.js'
	import { createPopperActions } from 'svelte-popperjs'

	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {string} [new_page_name]
	 * @property {string} [new_color]
	 * @property {string} [new_icon]
	 */

	/** @type {Props} */
	let { new_page_name = $bindable(''), new_color = $bindable('#2B407D'), new_icon = $bindable('iconoir:page') } = $props()
	let page_creation_disabled = $derived(!new_page_name)

	let new_page_details = $derived({
		id: uuid(),
		name: new_page_name,
		color: new_color,
		icon: new_icon
	})

	const [popperRef, popperContent] = createPopperActions({
		placement: 'bottom',
		strategy: 'fixed'
	})

	let showing_icon_picker = $state(false)
</script>

<form
	onsubmit={(e) => {
		e.preventDefault()
		dispatch('create', new_page_details)
	}}
	in:fade={{ duration: 100 }}
>
	<div style="width: 100%">
		<div class="top">
			<UI.TextInput autofocus={true} bind:value={new_page_name} id="page-label" label="Page Type Name" placeholder="Post" />
			<button
				use:popperRef
				onclick={() => (showing_icon_picker = true)}
				style="display: flex;
				align-items: center;
				justify-content: center;
				position: relative;
				margin-top: 22px;"
				type="button"
			>
				<span
					class="icon"
					style="    width: 2rem;
				aspect-ratio: 1;
				border-radius: 50%;
				background: var(--color-gray-8);
				display: flex;
				align-items: center;
				justify-content: center;"
				>
					<Icon icon={new_icon} />
				</span>
			</button>
			<div class="color">
				<label>
					<input type="color" bind:value={new_color} />
					<span class="preview" style:background-color={new_color}></span>
				</label>
			</div>
			<button class="save" disabled={page_creation_disabled} type="submit">
				<Icon icon="akar-icons:check" />
			</button>
		</div>
		{#if showing_icon_picker}
			<div
				use:popperContent={{
					modifiers: [{ name: 'offset', options: { offset: [0, 3] } }]
				}}
				use:clickOutside
				onclick_outside={() => (showing_icon_picker = false)}
				class="icon-picker"
				style="position: absolute;
    background: var(--color-gray-9);
    padding: 1rem;z-index: 9;    bottom: 12rem;
    left: 6rem;"
			>
				<IconPicker
					search_query={new_page_name}
					icon={new_icon}
					on:input={({ detail }) => {
						new_icon = detail
					}}
				/>
			</div>
		{/if}
	</div>
</form>

<style lang="postcss">
	.top {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}
	form {
		padding: 0.25rem;
		display: flex;
		gap: 0.5rem;
		padding: 0.825rem 1.125rem;
		align-items: center;
		background: #1a1a1a;
		--TextInput-label-font-size: 0.75rem;

		button.save {
			border: 1px solid var(--weave-primary-color);
			border-radius: 0.25rem;
			padding: 9px 0.75rem;
			margin-top: 23px;

			&:disabled {
				opacity: 20%;
			}
		}
	}

	.color {
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		margin-top: 22px;
		input {
			position: absolute;
			visibility: hidden;
			height: 0;
			width: 0;
		}
		.preview {
			display: block;
			width: 2rem;
			aspect-ratio: 1;
			border-radius: 50%;
		}
	}
</style>
