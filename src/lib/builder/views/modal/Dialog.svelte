<script>
	import Icon from '@iconify/svelte'
	import modal from '../../stores/app/modal'
	import Image from './Dialogs/Image.svelte'
	import Video from './Dialogs/Video.svelte'
	import Feedback from './Dialogs/Feedback.svelte'

	/**
	 * @typedef {Object} Props
	 * @property {any} component
	 * @property {any} [header]
	 * @property {any} [props]
	 * @property {any} onSubmit
	 */

	/** @type {Props} */
	let { component, header = null, props = {}, onSubmit } = $props()

	let value = $state('')
</script>

<main class="primo-reset">
	<header>
		<div class="title">
			{#if header}
				<Icon icon={header.icon} />
				<p>{header.title}</p>
			{/if}
		</div>
		<button onclick={() => modal.hide()}>
			<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
				<path d="M1 13L13 1M13 13L1 1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>
	</header>
	<div>
		{#if component === 'IMAGE'}
			<Image
				onsubmit={(detail) => {
					onSubmit(detail)
				}}
				{...props}
			/>
		{:else if component === 'VIDEO'}
			<Video onsubmit={(detail) => onSubmit(detail)} {...props} />
		{:else if component === 'LINK'}
			<div class="link">
				<div class="message">Enter URL</div>
				<form
					onsubmit={(event) => {
						event.preventDefault()
						onSubmit(value)
					}}
				>
					<!-- svelte-ignore a11y_autofocus -->
					<input type="url" bind:value autofocus />
				</form>
			</div>
		{:else if component === 'FEEDBACK'}
			<Feedback />
		{:else if typeof component !== 'string'}
			{@const SvelteComponent = component}
			<SvelteComponent {...props} />
		{/if}
	</div>
</main>

<style lang="postcss">
	main {
		color: var(--primo-color-white);
		background: var(--primo-color-black);
		border-radius: var(--primo-border-radius);
		display: flex;
		flex-direction: column;
		margin: 0 auto;
		width: 100%;
		max-width: 445px;
	}

	header {
		padding: 0.5rem;
		display: flex;
		justify-content: space-between;
		background: #1a1a1a;
		justify-content: space-between;
		border-bottom: 1px solid var(--color-gray-8);
		font-size: 0.875rem;
		font-weight: 500;

		.title {
			display: flex;
			align-items: center;
			gap: 0.25rem;
		}
	}

	form {
		input {
			padding: 0.5rem;
			color: white;
		}
	}
</style>
