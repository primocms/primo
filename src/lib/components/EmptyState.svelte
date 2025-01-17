<script>
	import { Button } from '$lib/components/ui/button'

	let { icon, title, description, link = null } = $props()
</script>

<div class="flex flex-col items-center justify-center h-[50vh] gap-6 flex-1">
	<div class="flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full dark:bg-gray-800">
		<svelte:component this={icon} class="w-10 h-10 text-gray-500 dark:text-gray-400" />
	</div>
	<div class="space-y-2 text-center">
		<h2 class="text-2xl font-bold tracking-tight">{title}</h2>
		<p class="text-gray-500 dark:text-gray-400">
			{description}
		</p>
	</div>
	{#if link}
		<Button href={link.url} variant="outline">
			<span>{link.label}</span>
			{#if link.icon}
				<svelte:component this={link.icon} />
			{/if}
		</Button>
	{/if}
</div>
