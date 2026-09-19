<script>
let { headline = '', body = '', image = null, items = [] } = $props()
</script>

<section class="content-block">
	<h1 data-testid="headline">{headline}</h1>
	<div data-testid="body">{@html body}</div>
	{#if image?.url}
		<img data-testid="image" src={image.url} alt={image.alt || ''} />
	{/if}
	<ul data-testid="items">
		{#each items as item}
			<li>
				<span class="item-name">{item.name}</span>
				<span class="item-description">{item.description}</span>
			</li>
		{/each}
	</ul>
</section>

<style>
	.content-block {
		padding: 2rem;
	}
</style>
