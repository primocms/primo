<script>
	import '../reset.css';
	import axios from 'axios';
	import { onMount } from 'svelte';
	import { browser } from '$app/env';
	import Primo, { modal as primoModal, registerProcessors } from '@primo-app/primo';
	import { saved } from '@primo-app/primo/src/stores/app/misc';
	import Build from './_Build.svelte';
	import * as primo from '@primo-app/primo/package.json';

	if (browser) {
		import('../compiler/processors').then(({ html, css }) => {
			registerProcessors({ html, css });
		});
	}

	primoModal.register([
		{
			id: 'BUILD',
			component: Build,
			componentProps: {
				siteName: 'Website' // TODO - change
			},
			options: {
				route: 'build',
				width: 'md',
				header: {
					title: 'Build to Github',
					icon: 'fab fa-github'
				}
			}
		}
	]);

	let data =
		browser && localStorage.getItem('demo-site')
			? JSON.parse(localStorage.getItem('demo-site'))
			: null;
	onMount(async () => {
		// const res = await axios.get('https://try-primo-template-mateomorris.vercel.app/primo.json');
		// console.log(res);
		// data = res.data;
	});

	let role = 'developer';

	async function saveData(updatedSite) {
		localStorage.setItem('demo-site', JSON.stringify(updatedSite));
		$saved = true;
	}

	$: console.log({ data });

	let saving = false;
</script>

{#if browser}
	<Primo {data} {role} {saving} on:save={async ({ detail: data }) => saveData(data)} />
{/if}
<div id="app-version">
	<span>try primo v{__DESKTOP_VERSION__}</span>
	<span>primo v{primo.version}</span>
</div>

<style global lang="postcss">
	body {
		margin: 0;

		--primo-color-primored: rgb(248, 68, 73);
		--primo-color-primored-dark: rgb(186, 37, 42);
		--primo-color-white: white;
		--primo-color-codeblack: rgb(30, 30, 30);
		--primo-color-codeblack-opaque: rgba(30, 30, 30, 0.9);

		--primo-color-black: rgb(17, 17, 17);
		--primo-color-black-opaque: rgba(17, 17, 17, 0.9);

		--color-gray-1: rgb(245, 245, 245);
		--color-gray-2: rgb(229, 229, 229);
		--color-gray-3: rgb(212, 212, 212);
		--color-gray-4: rgb(156, 163, 175);
		--color-gray-5: rgb(115, 115, 115);
		--color-gray-6: rgb(82, 82, 82);
		--color-gray-7: rgb(64, 64, 64);
		--color-gray-8: rgb(38, 38, 38);
		--color-gray-9: rgb(23, 23, 23);

		--font-size-1: 0.75rem;
		--font-size-2: 0.875rem;
		--font-size-3: 1.125rem;
		--font-size-4: 1.25rem;

		box-shadow: 0 0 #0000 0 0 #0000, 0 1px 2px 0 rgba(0, 0, 0, 0.05);
		--box-shadow-xl: 0 0 #0000, 0 0 #0000, 0 20px 25px -5px rgba(0, 0, 0, 0.1),
			0 10px 10px -5px rgba(0, 0, 0, 0.04);

		--transition-colors: background-color 0.1s, border-color 0.1s, color 0.1s, fill 0.1s,
			stroke 0.1s;

		--padding-container: 15px;
		--max-width-container: 1900px;

		--ring: 0px 0px 0px 2px var(--primo-color-primored);

		--primo-max-width-1: 30rem;
		--primo-max-width-2: 1200px;
		--primo-max-width-max: 1200px;

		--primo-ring-primored: 0px 0px 0px 2px var(--primo-color-primored);
		--primo-ring-primored-thin: 0px 0px 0px 1px var(--primo-color-primored);
		--primo-ring-primored-thick: 0px 0px 0px 3px var(--primo-color-primored);

		--primo-border-radius: 5px;
	}
	#app-version {
		font-size: 0.75rem;
		color: var(--color-gray-4);
		position: fixed;
		bottom: 0.5rem;
		left: 0.5rem;

		span:first-child {
			margin-right: 0.5rem;
		}
	}
</style>
