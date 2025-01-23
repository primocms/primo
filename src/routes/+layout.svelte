<script>
	import '../app.css'
	import { setContext } from 'svelte'
	import '@fontsource/fira-code/index.css'
	import { browser } from '$app/environment'
	import { compilers_registered } from '$lib/stores'
	import { onMount } from 'svelte'
	import { registerProcessors } from '$lib/builder/component'
	import Modal from '$lib/components/Modal.svelte'
	import { invalidate } from '$app/navigation'
	import supabase_client from '$lib/supabase/core'
	import { Toaster } from '$lib/components/ui/sonner'

	let { data, children } = $props()

	let { supabase, session } = $state(data)
	$effect.pre(() => {
		;({ supabase, session } = data)
	})

	$effect.pre(() => {
		session &&
			supabase_client.auth.setSession({
				access_token: session.access_token,
				refresh_token: session.refresh_token
			})
	})

	onMount(() => {
		if (!supabase) return
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((event, _session) => {
			if (_session?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth')
			}
		})
		return () => subscription.unsubscribe()
	})

	if (browser) {
		import('../compiler/processors').then(({ html, css }) => {
			registerProcessors({ html, css })
			$compilers_registered = true
		})
		setContext('track', () => {})
	}
</script>

<Modal />
<Toaster />
{@render children?.()}

<style lang="postcss">
	:global(.primo-reset) {
		@tailwind base;
		font-family: 'Inter', serif !important;
		direction: ltr;

		--transition-colors: background-color 0.1s, border-color 0.1s, color 0.1s, fill 0.1s, stroke 0.1s;

		--padding-container: 15px;
		--max-width-container: 1900px;

		--ring: 0px 0px 0px 2px var(--primo-color-brand);

		--primo-max-width-1: 30rem;
		--primo-max-width-2: 1200px;
		--primo-max-width-max: 1200px;

		--primo-border-radius: 5px;
	}

	:global(html) {
		--primo-color-brand: #35d994;
		--primo-color-brand-dark: #097548;
		--primo-color-white: white;
		--primo-color-codeblack: rgb(30, 30, 30);
		--primo-color-codeblack-opaque: rgba(30, 30, 30, 0.9);

		--primo-border-radius: 4px;

		--primo-color-danger: #ef4444;
		--primo-color-black: rgb(17, 17, 17);
		--primo-color-black-opaque: rgba(17, 17, 17, 0.95);

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

		--input-background: #2a2b2d;
		--input-border: 1px solid #222;
		--input-border-radius: 4px;

		--label-font-size: 1rem;
		--label-font-weight: 700;

		--title-font-size: 0.875rem;
		--title-font-weight: 700;

		--button-color: #fafafa;
		--primo-button-background: #37383a;
		--button-hover-color: #7d8082;

		box-shadow:
			0 0 #0000 0 0 #0000,
			0 1px 2px 0 rgba(0, 0, 0, 0.05);
		--box-shadow-xl: 0 0 #0000, 0 0 #0000, 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

		--transition-colors: background-color 0.1s, border-color 0.1s, color 0.1s, fill 0.1s, stroke 0.1s;

		--padding-container: 15px;
		--max-width-container: 1900px;

		--ring: 0px 0px 0px 2px var(--primo-color-brand);
		--primo-ring: 0px 0px 0px 2px var(--primo-color-brand, #35d994);
		--primo-ring-thin: 0px 0px 0px 1px var(--primo-color-brand, #35d994);
		--primo-ring-thick: 0px 0px 0px 3px var(--primo-color-brand, #35d994);
	}

	:global(.primo--field-label) {
		display: inline-flex;
		align-items: center;
		font-size: var(--font-size-1);
		line-height: var(--font-size-1);
		color: #9d9d9d;
		margin-bottom: 0.25rem;
		gap: 0.25rem;
	}

	:global(.primo--link) {
		display: inline-block;
		text-decoration: underline;
		font-size: var(--font-size-1);
		line-height: var(--font-size-1);
		color: #9d9d9d;
		margin-bottom: 0.25rem;
		/* contains icon */
		display: flex;
		align-items: center;
		gap: 2px;
	}

	:global(button, a) {
		cursor: pointer;
	}

	:global(body) {
		margin: 0;
	}

	:global(.primo-input) {
		appearance: none;
		border: 0;
		background-color: transparent;
		font-size: inherit;
		background: var(--color-white);
		padding: 0.5rem 0.75rem;
		width: 100%;
	}

	:global(.primo-modal) {
		color: var(--color-gray-1);
		/* background: var(--color-gray-9); */
		/* padding: 1.5rem; */

		/* padding: 0.5rem; */
		border-radius: var(--primo-border-radius);
		margin: 0 auto;
		/* width: 100vw; */
	}

	:global(.primo-heading-xl) {
		margin-bottom: 0.5rem;
		font-size: 1.25rem;
		line-height: 1.75rem;
		font-weight: 700;
	}

	:global(.primo-heading-lg) {
		margin-bottom: 0.25rem;
		font-size: 1.1rem;
		line-height: 1.5rem;
		font-weight: 700;
	}

	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
