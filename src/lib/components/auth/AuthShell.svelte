<script lang="ts">
	import { Globe } from 'lucide-svelte'
	import type { Snippet } from 'svelte'
	let { children }: { children: Snippet } = $props()
</script>

<main class="auth-shell">
	<div class="auth-card">
		<div class="auth-brand">
			<Globe size={20} aria-hidden="true" />
			<span>Primo</span>
		</div>
		{@render children()}
	</div>
</main>

<style>
	.auth-shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 32px 16px;
		background: hsl(var(--background));
		color: hsl(var(--foreground));
		font-family: 'Inter', sans-serif;
	}
	.auth-card {
		width: 100%;
		max-width: 420px;
		padding: 28px;
		border: 1px solid hsl(var(--border));
		border-radius: 8px;
		background: hsl(var(--card));
		box-shadow: 0 8px 32px #0002;
	}
	.auth-brand {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 28px;
		font-size: 14px;
		font-weight: 600;
	}
	.auth-shell :global(h1) {
		margin: 0;
		font-size: 22px;
		line-height: 1.3;
		font-weight: 500;
		letter-spacing: -0.025em;
	}
	.auth-shell :global(.auth-description) {
		margin: 8px 0 24px;
		color: hsl(var(--muted-foreground));
		font-size: 13px;
		line-height: 1.6;
	}
	.auth-shell :global(.auth-form) {
		display: grid;
		gap: 20px;
	}
	.auth-shell :global(.auth-fields) {
		display: grid;
		gap: 16px;
	}
	.auth-shell :global(.auth-label) {
		display: grid;
		gap: 8px;
		font-size: 13px;
	}
	.auth-shell :global(.auth-note) {
		color: hsl(var(--muted-foreground));
		font-size: 12px;
		line-height: 1.6;
	}
	.auth-shell :global(.auth-alert) {
		margin-bottom: 20px;
		padding: 12px;
		border: 1px solid hsl(var(--border));
		border-radius: 6px;
		background: hsl(var(--muted) / 0.4);
		font-size: 13px;
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
	.auth-shell :global(.auth-error) {
		border-color: hsl(var(--destructive) / 0.5);
		color: #fca5a5;
		background: hsl(var(--destructive) / 0.08);
	}
	.auth-shell :global(.auth-footer) {
		display: flex;
		justify-content: center;
		margin-top: 20px;
		font-size: 13px;
		color: hsl(var(--muted-foreground));
	}
	.auth-shell :global(.auth-footer button) {
		padding: 4px;
		border-radius: 4px;
	}
	.auth-shell :global(.auth-footer button:hover) {
		color: hsl(var(--foreground));
	}
	.auth-shell :global(.auth-footer button:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
	@media (max-width: 480px) {
		.auth-card {
			padding: 24px 20px;
		}
	}
</style>
