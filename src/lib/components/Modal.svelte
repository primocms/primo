<script module>
	import { writable } from 'svelte/store'

	const defaultValue = {
		id: null,
		props: {},
		options: {
			disableClose: false,
			disable_bg_close: false,
			max_width: null
		}
	}

	export const type = writable(defaultValue)

	export const visible = writable(false)

	export function show(t) {
		if (typeof t === 'string') {
			type.set({
				...defaultValue,
				id: t
			})
		} else {
			type.set(t)
		}
		visible.set(true)
	}

	export function hide() {
		type.set(defaultValue)
		visible.set(false)
	}
</script>

<script>
	import { fade } from 'svelte/transition'
	import Deploy from './Modals/Deploy/Deploy.svelte'
	import DesignPanel from './Modals/DesignPanel.svelte'
	import Collaboration from './Modals/Collaboration.svelte'

	const modals = {
		DEPLOY: Deploy,
		DESIGN: DesignPanel,
		COLLABORATION: Collaboration
	}

	let activeModal = $state(modals[$type.id])
	async function showModal(typeID) {
		activeModal = modals[typeID]
	}

	async function hideModal() {
		$visible = false
	}
	$effect(() => {
		showModal($type.id)
	})
</script>

{#if $visible}
	{@const disabled_close = $type.options?.disableClose || $type.options?.disable_bg_close}
	{@const SvelteComponent = activeModal}
	<div class="modal mousetrap primo-reset" transition:fade={{ duration: 100 }}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="modal-background" onclick={disabled_close ? () => {} : hideModal} class:disabled={disabled_close}></div>
		<div class="modal-card" style:max-width={$type.options.max_width} style:height={$type.options.height}>
			<SvelteComponent {...$type.props} />
		</div>
	</div>
{/if}

<style lang="postcss">
	.modal {
		display: flex;
		flex-direction: column;
		align-items: center;
		/* justify-content: center; */
		overflow: hidden;
		position: fixed;
		z-index: 9999999999;
		inset: 0;
		padding: 0.5rem;
	}

	.modal-background {
		inset: 0;
		position: absolute;
		background: var(--primo-color-black);
		opacity: 0.95;
		cursor: pointer;
		transition: opacity 0.1s;

		&:hover {
			opacity: 0.9;
		}

		&.disabled {
			cursor: default;

			&:hover {
				opacity: 0.95;
			}
		}
	}

	.modal-card {
		max-height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		margin: 0 auto;
		position: relative;
		border-radius: var(--primo-border-radius);
		background: var(--color-gray-9);
	}
</style>
