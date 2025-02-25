<script>
	import { onMount } from 'svelte'
	import { fade } from 'svelte/transition'
	import modal from '../../stores/app/modal'

	let { visible, children } = $props();
</script>

{#if visible}
	<div
		id="primo-modal"
		class="primo-modal modal mousetrap primo-reset"
		transition:fade={{ duration: 100 }}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="modal-background"
			class:hovered={!$modal.disabledBgClose}
			onclick={$modal.disabledBgClose ? () => {} : () => modal.hide()}
		></div>
		<div class="modal-card" style:max-width={$modal.maxWidth}>
			<div class="modal-card-body">
				{@render children?.()}
			</div>
			{#if $modal.footer}
				{@const SvelteComponent = $modal.footer}
				<SvelteComponent />
			{/if}
		</div>
	</div>
{/if}

<style lang="postcss">
	.modal {
		-webkit-overflow-scrolling: touch;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		align-items: center;
		overflow: hidden;
		position: fixed;
		z-index: 999999999;
		inset: 0;
		top: 0;
	}

	.modal-background {
		position: absolute;
		inset: 0;
		background: var(--primo-color-black);

		&.hovered {
			opacity: 0.95;
			transition: opacity 0.1s;
			cursor: pointer;
		}
	}

	.modal-card {
		display: flex;
		flex-direction: column;
		width: 100%;
		overflow: hidden;
		position: relative;
		border-radius: var(--primo-border-radius);
		/* flex: 1; */
		padding: 0.5rem;

		max-height: 100vh;
		justify-content: center;
		pointer-events: none;
		height: 100%;
		/* padding: 0 1rem; pushes content out of sight on windows if vertical */
		/* height: 100%;  make component editor full height when in cms) */
	}

	.modal-card-body {
		border-radius: 1px;
		/* flex: 1; */
		display: flex;
		flex-direction: column;
		border-radius: var(--primo-border-radius);
		/* justify-content: center; */
		justify-content: flex-start;
		height: 100%;
		pointer-events: all;
		/* height: calc(
      100vh - 6rem
    );  to allow children to scroll on overflow (i.e. not grow) */
		/* overflow-y: scroll; */ /* causes Styles to scroll by an inch */
	}
</style>
