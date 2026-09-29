<script>
	/**
	 * @typedef {Object} Props
	 * @property {'dots' | 'loop'} [variant]
	 */

	/** @type {Props} */
	let { variant = 'dots' } = $props()
</script>

{#if variant === 'loop'}
	<div class="Spinner loop" role="status" aria-label="Loading"></div>
{:else}
	<div class="Spinner dots" role="status" aria-label="Loading">
		<span></span>
		<span></span>
		<span></span>
	</div>
{/if}

<style>
	/*
		Both variants were previously animated SMIL icons
		(line-md:loading-twotone-loop / eos-icons:three-dots-loading). SMIL
		animations don't run in Safari, where they rendered as static glyphs,
		so the spinners are now pure CSS animations that work everywhere.
	*/
	.Spinner {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--Spinner-color);
		font-size: var(--Spinner-font-size, inherit);
		padding: var(--Spinner-padding);
	}

	.loop {
		width: 1em;
		height: 1em;
		border: max(2px, 0.1em) solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spinner-rotate 0.85s linear infinite;
	}

	.dots {
		gap: 0.16em;
	}
	.dots span {
		width: 0.21em;
		height: 0.21em;
		border-radius: 50%;
		background: currentColor;
		animation: spinner-dot 1s ease-in-out infinite;
	}
	.dots span:nth-child(2) {
		animation-delay: 0.15s;
	}
	.dots span:nth-child(3) {
		animation-delay: 0.3s;
	}

	@keyframes spinner-rotate {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes spinner-dot {
		0%,
		100% {
			opacity: 0.25;
		}
		50% {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.loop {
			animation: none;
			border-right-color: currentColor;
		}
		.dots span {
			animation: none;
			opacity: 0.6;
		}
	}
</style>
