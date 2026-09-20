<script>
	import Icon from '@iconify/svelte'
	import * as Dialog from '$lib/components/ui/dialog'
	import { page } from '$app/state'
	import { onModKey } from '$lib/builder/utils/keyboard'
	import { mod_key_held } from '$lib/builder/stores/app/misc'
	import { instance } from '$lib/instance'

	let { stage = $bindable(), publish_fn, loading, site_host, onConnectDomain, onClose } = $props()

	let error = $state(null)

	async function handle_publish() {
		try {
			error = null
			await publish_fn()
			stage = 'PUBLISHED'
		} catch (err) {
			console.error('Publish error:', err)
			error = err.message || err.toString() || 'Failed to publish site'
			stage = 'ERROR'
		}
	}

	stage = stage || 'INITIAL'

	// Set up hotkey listener for Cmd/Ctrl+P to confirm publish
	onModKey('p', () => {
		if (stage === 'INITIAL' && !loading) {
			handle_publish()
		}
	})
</script>

<div class="Deploy primo-reset">
	{#if stage === 'INITIAL'}
		<div class="container">
			<Dialog.Title class="publish-title">{instance.dev_mode ? 'Preview site' : 'Publish site'}</Dialog.Title>
			{#if site_host}
				<p class="description">
					{instance.dev_mode ? 'Your website will be previewed at' : 'Your website will be published to'}
					<a href="{page.url.protocol}//{site_host}" target="_blank">{site_host}</a>
				</p>
			{:else if instance.dev_mode}
				<p class="description">Ready to preview your website changes?</p>
			{:else}
				<p class="description">Ready to publish? This site has no domain yet — publish now, then connect a domain to make it public.</p>
			{/if}
			<div class="buttons">
				<button class="primo-button" onclick={onClose}>
					<span>Cancel</span>
				</button>
				<button class="primo-button primary" onclick={handle_publish} disabled={loading}>
					<Icon icon={loading ? 'line-md:loading-twotone-loop' : instance.dev_mode ? 'lucide:eye' : 'entypo:publish'} class={$mod_key_held && !loading ? 'invisible' : ''} />
					<span class:invisible={$mod_key_held && !loading}>{loading ? (instance.dev_mode ? 'Building...' : 'Publishing...') : instance.dev_mode ? 'Build preview' : 'Publish changes'}</span>
					{#if $mod_key_held && !loading}
						<span class="key-hint">⌘P</span>
					{/if}
				</button>
			</div>
		</div>
	{:else if stage === 'PUBLISHED'}
		<div class="container">
			<Dialog.Title class="publish-title">{instance.dev_mode ? 'Preview ready' : 'Changes published'}</Dialog.Title>
			<p class="description">
				{#if site_host}
					{instance.dev_mode ? 'Your website preview is ready at' : 'Your website changes have been published to'}
					<a href="{page.url.protocol}//{site_host}" target="_blank">{site_host}</a>
				{:else if instance.dev_mode}
					Your website preview is ready on your local server.
				{:else}
					Your changes are published. Connect a domain to make this site public.
				{/if}
			</p>
			<div class="buttons">
				<button class="primo-button primary" onclick={onClose}>
					<span>Done</span>
				</button>
				{#if site_host}
					<a href="{page.url.protocol}//{site_host}" target="_blank" class="primo-button">
						<Icon icon="lucide:external-link" />
						<span>{instance.dev_mode ? 'View preview' : 'View site'}</span>
					</a>
				{:else if !instance.dev_mode && onConnectDomain}
					<button class="primo-button" onclick={onConnectDomain}>
						<Icon icon="lucide:globe" />
						<span>Connect a domain</span>
					</button>
				{/if}
			</div>
		</div>
	{:else if stage === 'ERROR'}
		<div class="container">
			<Dialog.Title class="publish-title">{instance.dev_mode ? 'Preview failed' : 'Publishing failed'}</Dialog.Title>
			<p class="error" role="alert">{error}</p>
			<div class="buttons">
				<button class="primo-button" onclick={onClose}>
					<span>Close</span>
				</button>
				<button class="primo-button primary" onclick={() => (stage = 'INITIAL')}>
					<span>Try again</span>
				</button>
			</div>
		</div>
	{/if}
</div>

<style lang="postcss">
	.Deploy.primo-reset { color: #e4e4e7; background: #1e1e20; padding: 44px 24px 22px; width: 100%; border-radius: inherit; }
	.container { display: grid; gap: 14px; }
	.Deploy :global(.publish-title) { font-size: 18px; font-weight: 500; color: #f4f4f5; }
	.description { color: #a9a9b2; font-size: 13px; line-height: 1.65; overflow-wrap: anywhere; }
	.description a { display: block; width: fit-content; max-width: 100%; margin-top: 10px; color: #e4e4e7; text-decoration: underline; text-underline-offset: 3px; }
	.error { padding: 12px; background: #ef444410; border: 1px solid #ef444450; color: #fca5a5; border-radius: 6px; font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
	.buttons { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 8px; padding-top: 18px; border-top: 1px solid #343437; }
	.primo-button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 36px; padding: 8px 13px; background: #252528; border: 1px solid #3a3a40; border-radius: 5px; color: #dedee3; cursor: pointer; text-decoration: none; font-size: 12px; font-weight: 400; position: relative; }
	.primo-button:hover { background: #303034; }
	.primo-button.primary { background: #ededf0; color: #202023; border-color: #ededf0; font-weight: 500; }
	.primo-button.primary:hover { background: white; border-color: white; }
	.primo-button:disabled { opacity: .55; cursor: not-allowed; }
	.primo-button:focus-visible { outline: 2px solid #956e51; outline-offset: 3px; }
	.primo-button :global(svg) { width: 15px; height: 15px; flex-shrink: 0; }
	.key-hint { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 12px; pointer-events: none; }
	@media (max-width: 480px) { .Deploy.primo-reset { padding-inline: 18px; } }
</style>
