<script>
	import { convert_markdown_to_html } from '../utils'

	let { field = {
		options: {
			info: ''
		}
	} } = $props();

	let html = $state('')
	convert_markdown_to_html(field.options.info).then((result) => {
		html = result
	})
</script>

<div class="main info-field">
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
		<path
			fill-rule="evenodd"
			d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
			clip-rule="evenodd"
		/>
	</svg>
	{@html html}
</div>

<style lang="postcss">
	.main {
		position: relative;
		padding-top: 1rem;
	}
	svg {
		position: absolute;
		top: -0.5rem;
		left: -0.5rem;
		width: 1rem;
		height: 1rem;
		opacity: 0.75;
	}
	:global(.main.info-field h1) {
		font-size: 1.75rem;
	}

	:global(.main.info-field h2) {
		font-size: 1.25rem;
	}

	:global(.main.info-field a) {
		color: cornflowerblue;
		text-decoration: underline cornflowerblue;
	}

	:global(.main.info-field img) {
		width: 100%;
	}

	:global(.main.info-field ul, .main.info-field ol) {
		list-style: initial;
		padding-left: 1rem;
	}
</style>
