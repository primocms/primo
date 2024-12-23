<!-- @migration-task Error while migrating Svelte code: This migration would change the name of a slot making the component unusable -->
<script>
	import { onDestroy } from 'svelte'
	import Icon from '@iconify/svelte'
	import modal from '../../stores/app/modal'
	import { mod_key_held } from '../../stores/app/misc.js'
	import hotkey_events from '../../stores/app/hotkey_events.js'
	// import LocaleSelector from '../../views/editor/LocaleSelector.svelte'

	export let variants = ''
	export let icon = ''
	export let svg = ''
	export let title = ''

	/** @type {{ icon: string, label?: string, onclick: function, disabled: boolean } | null} */
	export let button = null
	export let warn = () => true
	export let onclose = () => {}

	hotkey_events.on('escape', () => {
		closeModal()
	})
	// hotkey_events.on('save', button?.onclick) // need to pass stuff, dispatch from modals

	function closeModal() {
		if (warn()) {
			onclose()
			modal.hide()
		}
	}

	onDestroy(() => Mousetrap.unbind(['escape', 'mod+s']))
</script>

<header class={variants}>
	<div class="left-container">
		<button on:click={closeModal} type="button" aria-label="Close modal">
			<svg stroke="currentColor" fill="none" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		</button>
		<slot name="left"><!-- optional fallback --></slot>
	</div>
	<div class="center-container">
		<slot name="title">
			{#if icon}
				<span class="icon">
					<Icon {icon} />
				</span>
			{:else if svg}
				<div class="svg">{@html svg}</div>
			{/if}
			<span class="modal-title">{title}</span>
		</slot>
	</div>
	<div class="right-container">
		<slot />
		{#if button && button.onclick}
			<button class="primo-button primary" class:showing_key_hint={$mod_key_held} disabled={button.loading || button.disabled} on:click={button.onclick}>
				{#if $mod_key_held}
					<span class="key-hint">&#8984; S</span>
				{/if}
				<span class="label">
					{#if button.icon}
						<Icon icon={button.loading ? 'gg:spinner' : button.icon} />
					{/if}
					<span>{button.label}</span>
				</span>
			</button>
		{:else if button && button.href}
			<a class="primo-button primary" disabled={button.loading || button.disabled} href={button.href} target="blank">
				{#if button.icon}
					<Icon icon={button.loading ? 'gg:spinner' : button.icon} />
				{/if}
				<span>{button.label}</span>
			</a>
		{/if}
	</div>
</header>

<style lang="postcss">
	header {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		position: relative;
		background: var(--primo-color-black);
		color: var(--color-gray-1);
		font-size: var(--font-size-3);
		/* font-weight: 600; */
		padding: 0.5rem;

		.left-container {
			flex: 1;
			display: flex;
			justify-content: flex-start;
			align-items: center;
			height: 100%;

			button {
				display: inline-flex;
				align-items: center;
				justify-content: center;
				border-radius: var(--primo-border-radius);
				color: var(--color-gray-4);
				padding-right: 0.5rem;
				transition: var(--transition-colors);

				&:hover {
					color: var(--primo-color-brand);
				}

				&:focus {
					color: var(--primo-color-brand);
					outline: 0;
				}

				svg {
					width: 1.5rem;
					height: 1.5rem;
				}
			}
		}

		.center-container {
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: var(--font-size-2);
			/* font-weight: 600; */
			gap: 0.25rem;

			.modal-title {
				font-weight: 500;
			}

			.svg {
				:global(svg) {
					--size: 1rem;
					width: var(--size);
					height: var(--size);
				}
			}
		}

		.right-container {
			flex: 1;
			display: flex;
			justify-content: flex-end;
		}
	}

	.primo-button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem 0.75rem;
		font-size: var(--font-size-2);
		border-radius: var(--primo-border-radius);
		transition:
			var(--transition-colors),
			0.1s box-shadow;

		&.primary {
			/* border: 2px solid var(--primo-color-brand); */
			color: var(--primo-color-white);
			background: #1a1a1a;
			/* background: #292929; */
			/* background: var(--color-gray-8); */
			padding: 0.625rem 1rem;
			/* margin-left: 0.5rem; */

			.key-hint {
				position: absolute;
			}

			.label {
				display: flex;
				align-items: center;
				gap: 0.25rem;
			}

			span {
				display: none;

				@media (min-width: 900px) {
					display: inline-block;
				}
			}

			&:hover {
				box-shadow: var(--primo-ring);
			}

			&:active {
				color: var(--primo-color-black);
				background: var(--primo-color-brand);
			}

			&.showing_key_hint .label {
				visibility: hidden;
			}
		}

		&.switch {
			border: 2px solid var(--primo-color-brand);
			color: var(--primo-color-brand);
			outline-color: var(--primo-color-brand);

			&:hover {
				background: var(--primo-color-brand-dark);
				color: var(--primo-color-white);
				border-color: var(--primo-color-brand-dark);
			}
		}
	}

	button[disabled] {
		opacity: 0.25;
		transition: opacity 0.1s;
	}
</style>
