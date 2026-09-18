<script lang="ts">
	import './catalog-cards.css'
	import SitePreview from '$lib/components/SitePreview.svelte'
	import { ExternalLink } from 'lucide-svelte'
	import type { Site } from '$lib/common/models/Site'

	let { site }: { site: Site } = $props()
	const description = $derived(site.description?.trim())
</script>

<a class="catalog-card starter-card" href={`https://${site.host}`} target="_blank" rel="noopener noreferrer" aria-label={`Preview ${site.name} (opens in a new tab)`}>
	<div class="catalog-preview">
		<SitePreview {site} style="--thumbnail-height: 100%; background: #27272b;" src={`https://${site.host}`} />
	</div>
	<div class="starter-details">
		<div class="starter-heading">
			<h2 class="catalog-name" title={site.name}>{site.name}</h2>
			<span class="preview-label">Preview <ExternalLink class="h-3 w-3" /></span>
		</div>
		{#if description}
			<p class="starter-description">{description}</p>
		{/if}
	</div>
</a>

<style lang="postcss">
	.starter-card {
		display: block;
		color: inherit;
		text-decoration: none;
	}
	.starter-card:focus-visible {
		outline: 2px solid #c4c4ce;
		outline-offset: 3px;
	}
	.starter-details {
		padding: 16px;
	}
	.starter-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-width: 0;
	}
	.preview-label {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
		font-size: 12px;
		color: #a5a5ad;
	}
	.starter-card:hover .preview-label {
		color: #f4f4f5;
	}
	.starter-description {
		margin-top: 8px;
		color: #a5a5ad;
		font-size: 12px;
		line-height: 1.6;
		overflow-wrap: anywhere;
	}
</style>
