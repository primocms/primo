<script>
	/**
	 * @typedef {Object} Props
	 * @property {string} [label]
	 * @property {any} value
	 * @property {() => void} oninput
	 */

	/** @type {Props} */
	let { label = '', value, oninput } = $props()
</script>

<div class="label-container">
	<label>
		{#if label}
			<span class="primo--field-label">{label}</span>
		{/if}
		<div class="switch-container">
			<input type="checkbox" oninput={() => oninput(!value)} checked={value} />
			<span></span>
		</div>
	</label>
</div>

<style lang="postcss">
	.label-container {
		width: 100%;

		label {
			display: grid;
			gap: 0.5rem;

			.switch-label {
				font-weight: 600;
				margin-right: 1rem;
			}

			.switch-container {
				position: relative;
				display: inline-block;
				width: 3.5rem;
				vertical-align: middle;
				user-select: none;
				transition: transform 0.1s;

				input {
					color: var(--weave-primary-color);
					background: var(--primo-color-white);
					outline: 0;
					position: absolute;
					top: -4px;
					display: flex;
					align-items: center;
					justify-content: center;
					width: 2rem;
					height: 2rem;
					border-radius: 100%;
					appearance: none;
					cursor: pointer;
					left: 0;
					transition: transform 0.1s;

					&:after {
						content: '\d7';
					}

					&:checked {
						transform: translateX(24px);

						&:after {
							content: '\2713';
						}
					}

					&:focus {
						outline: 2px solid var(--weave-primary-color);
					}
				}

				span {
					outline: 0;
					display: block;
					overflow: hidden;
					height: 1.5rem;
					border-radius: 1rem;
					background: var(--color-gray-7);
					cursor: pointer;
				}
			}
		}
	}
</style>
