<script>
	import { Button } from '$lib/components/ui/button'
	let { icon: Icon, title, description, class: className = '', link = null, button = null, secondary = null } = $props()
</script>

<div class="flex flex-col items-center justify-center gap-4 flex-1 px-4 py-8 {className}">
	<div class="flex items-center justify-center size-12 rounded-lg bg-muted/30 text-muted-foreground"><Icon class="size-6" aria-hidden="true" /></div>
	<div class="space-y-2 text-center">
		<h2 class="text-base font-medium tracking-tight">{title}</h2>
		<p class="text-sm text-muted-foreground text-balance max-w-sm leading-relaxed">{description}</p>
	</div>
	{#if link || button || secondary}
		<div class="flex flex-wrap justify-center gap-2">
			{#if link}<Button href={link.url} variant="outline" size="sm">{link.label}</Button>
			{:else if button}<Button onclick={button.onclick} disabled={button.disabled} size="sm">
					{#if button.icon}<button.icon aria-hidden="true" />{/if}{button.label}
				</Button>{/if}
			{#if secondary}<Button href={secondary.url} onclick={secondary.onclick} variant="outline" size="sm">{secondary.label}</Button>{/if}
		</div>
	{/if}
</div>
