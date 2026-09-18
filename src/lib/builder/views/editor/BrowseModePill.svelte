<script lang="ts">
	import { Lock, Check, Copy } from 'lucide-svelte'
	import * as Popover from '$lib/components/ui/popover/index.js'

	const command = 'primo dev --author cms'

	let copied = $state(false)
	let copy_timeout: ReturnType<typeof setTimeout> | undefined

	async function copy_command() {
		try {
			await navigator.clipboard.writeText(command)
			copied = true
			clearTimeout(copy_timeout)
			copy_timeout = setTimeout(() => (copied = false), 2000)
		} catch (e) {
			// Clipboard can be unavailable (insecure context, denied permission).
			// The command stays visible and selectable, so this is non-fatal.
			console.warn('Could not copy to clipboard', e)
		}
	}

	$effect(() => () => clearTimeout(copy_timeout))
</script>

<Popover.Root>
	<Popover.Trigger>
		{#snippet child({ props })}
			<button {...props} class="browse-pill" aria-label="Browse mode — local files are authoritative">
				<Lock class="size-3" />
				<span>Browse</span>
				<span class="separator">·</span>
				<span class="source">Local files</span>
			</button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content side="bottom" align="end" sideOffset={6} class="z-[999] w-[280px]">
		<div class="browse-popover">
			<p>Your local files control this site. Explore its pages, blocks, and fields here.</p>
			<p>To make changes, edit the files with your agent or restart with:</p>
			<div class="command-row">
				<code>{command}</code>
				<button onclick={copy_command} aria-label="Copy command" title="Copy command">
					{#if copied}
						<Check class="size-3.5" />
					{:else}
						<Copy class="size-3.5" />
					{/if}
				</button>
			</div>
		</div>
	</Popover.Content>
</Popover.Root>

<style lang="postcss">
	.browse-pill {
		display: flex;
		align-items: center;
		gap: 5px;
		height: 28px;
		padding: 0 10px;
		border: 1px solid #36363a;
		border-radius: 999px;
		background: #202023;
		color: #d4d4d8;
		font-size: 12px;
		white-space: nowrap;
		transition:
			background-color 0.15s,
			color 0.15s;
		&:hover {
			background: #303034;
			color: #fff;
		}
		&:focus-visible {
			outline: 2px solid #c4c4ce;
			outline-offset: 3px;
		}
		.separator {
			color: #64646d;
		}
		.source {
			color: #a5a5ad;
		}
	}
	.browse-popover {
		display: grid;
		gap: 8px;
		font-size: 12px;
		line-height: 1.5;
		color: var(--color-gray-2, #d4d4d8);

		p {
			margin: 0;
		}

		.command-row {
			display: flex;
			align-items: center;
			gap: 6px;

			code {
				flex: 1;
				min-width: 0;
				overflow-x: auto;
				padding: 4px 7px;
				border-radius: 4px;
				background: rgba(0, 0, 0, 0.3);
				font-family: 'Fira Code', monospace;
				font-size: 11px;
				white-space: nowrap;
			}

			button {
				display: flex;
				align-items: center;
				justify-content: center;
				flex-shrink: 0;
				height: 26px;
				width: 26px;
				border-radius: 4px;
				color: #b8b8c0;
				transition:
					background-color 0.15s,
					color 0.15s;
				&:hover {
					background: #303034;
					color: #fff;
				}
				&:focus-visible {
					outline: 2px solid #c4c4ce;
					outline-offset: 2px;
				}
			}
		}
	}

	@media (max-width: 900px) {
		.browse-pill .source,
		.browse-pill .separator {
			display: none;
		}
	}
</style>
