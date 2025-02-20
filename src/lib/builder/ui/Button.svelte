<!-- @migration-task Error while migrating Svelte code: This migration would change the name of a slot making the component unusable -->
<script>
	import UI from '$lib/builder/ui'
	import Icon from '@iconify/svelte'

	/**
	 * @typedef {Object} Props
	 * @property {string} [label]?
	 * @property {() => void} [onclick]?
	 * @property {string} [icon]?
	 * @property {'button' | 'submit'} [type]?
	 * @property {string} [variants]?
	 * @property {boolean} [disabled]?
	 * @property {boolean} [loading]?
	 * @property {boolean} [arrow]?
	 * @property {import('svelte').Snippet} [children]
	 */

	/** @type {Props} */
	let { label, onclick, icon, variants = '', type = /** @type {"button" | "submit"} */ ('button'), children, disabled = false, loading = false, arrow = false } = $props()
</script>

<button class="Button {variants}" {onclick} {type} disabled={disabled || loading}>
	{#if loading}
		<UI.Spinner />
	{/if}
	{#if icon}
		<span class:hidden={loading}>
			<Icon {icon} />
		</span>
	{/if}
	{#if children}
		{@render children()}
	{:else if label}
		<span class:hidden={loading}>{label}</span>
	{/if}
	{#if arrow}
		<Icon icon="ooui:arrow-next-ltr" />
	{/if}
</button>

<style lang="postcss">
	.Button {
		box-shadow: var(--primo-ring-thin);
		color: #cecece;
		padding: 0.5rem;
		font-weight: 00;
		margin-top: var(--Button-mt, 0);
		margin-bottom: var(--Button-mb, 0);
		margin-left: var(--Button-ml, 0);
		margin-right: var(--Button-mr, 0);
		transition: 0.1s;
		font-size: 0.875rem;

		border-top-right-radius: var(--Button-round-tr, 0.25rem);
		border-top-left-radius: var(--Button-round-tl, 0.25rem);
		border-bottom-right-radius: var(--Button-round-br, 0.25rem);
		border-bottom-left-radius: var(--Button-round-bl, 0.25rem);

		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
		gap: 0.5rem;
		font-weight: 500;

		&:hover {
			box-shadow: var(--primo-ring-thin);
			/* background: var(
        --Button-bg-hover,
        var(--weave-primary-color-dark)
      );
      color: var(--Button-color-hover, var(--primo-color-white)); */
		}

		&[disabled] {
			color: #cecece;
			border: 1px solid #70809e;
			opacity: 0.2;
			cursor: not-allowed;
		}

		&.fullwidth {
			width: 100%;
		}

		&.secondary {
			font-weight: 400;
			box-shadow: none;
			display: flex;
			align-items: center;
			gap: 0.25rem;
			padding-block: 0.5rem;
			background: #1f1f1f;
			border-radius: 0.25rem;
			justify-self: start;
			border-color: transparent;
			/* height: 100%; */
		}
	}
</style>
