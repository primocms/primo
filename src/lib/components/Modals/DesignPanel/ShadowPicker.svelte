<script>
	import { createEventDispatcher } from 'svelte'

	const dispatch = createEventDispatcher()

	let { label, value, oninput } = $props()

	const Option = (label, value) => ({
		label,
		value
	})

	const options = [
		Option('Flat', '0'),
		Option('Low', `0.3px 0.5px 0.7px hsl(0deg 36% 56% / 0.34),0.4px 0.8px 1px -1.2px hsl(0deg 36% 56% / 0.34), 1px 2px 2.5px -2.5px hsl(0deg 36% 56% / 0.34)`),
		Option(
			'Medium',
			`0.3px 0.5px 0.7px hsl(0deg 36% 56% / 0.36), 0.8px 1.6px 2px -0.8px hsl(0deg 36% 56% / 0.36), 2.1px 4.1px 5.2px -1.7px hsl(0deg 36% 56% / 0.36), 5px 10px 12.6px -2.5px hsl(0deg 36% 56% / 0.36)`
		),
		Option(
			'High',
			`0.3px 0.5px 0.7px hsl(0deg 36% 56% / 0.34),
		1.5px 2.9px 3.7px -0.4px hsl(0deg 36% 56% / 0.34),
		2.7px 5.4px 6.8px -0.7px hsl(0deg 36% 56% / 0.34),
		4.5px 8.9px 11.2px -1.1px hsl(0deg 36% 56% / 0.34),
		7.1px 14.3px 18px -1.4px hsl(0deg 36% 56% / 0.34),
		11.2px 22.3px 28.1px -1.8px hsl(0deg 36% 56% / 0.34),
		17px 33.9px 42.7px -2.1px hsl(0deg 36% 56% / 0.34),
		25px 50px 62.9px -2.5px hsl(0deg 36% 56% / 0.34)`
		)
	]

	function set_value(option) {
		value = option.value
		dispatch('input')
		oninput(value)
	}
</script>

<label>
	<span>{label}</span>
	<div class="options">
		{#each options as option}
			<button class:active={option.value === value} style="box-shadow: {option.value}" onclick={() => set_value(option)}>{option.label}</button>
		{/each}
	</div>
</label>

<style lang="postcss">
	span {
		font-size: var(--label-font-size, 1rem);
		font-weight: var(--label-font-weight, 700);
		margin-bottom: 0.5rem;
	}
	label {
		display: grid;
	}
	.options {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr 1fr;
		background: #eee;
		padding: 1.5rem;
		color: #222;
		gap: 2rem;
		/* border-radius: var(--DesignPanel-border-radius); */

		button {
			/* border-radius: var(--DesignPanel-border-radius); */
			font-size: 0.875rem;
			padding: 0.5rem;
			font-family: var(--DesignPanel-font-heading);
			outline: 0.5rem solid transparent;
			outline: 1px solid transparent;
			transition: 0.1s;

			&.active {
				outline: 2px solid var(--DesignPanel-brand-color, black);
			}
		}
	}
</style>
