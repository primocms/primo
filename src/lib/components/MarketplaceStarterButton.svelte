<script>
	import axios from 'axios'
	import { toast } from 'svelte-sonner'
	import SitePreview from '$lib/components/SitePreview.svelte'
	import { CircleCheck, CirclePlus, Loader } from 'lucide-svelte'
	import { find as _find } from 'lodash-es'
	import { Button } from '$lib/components/ui/button'
	import { invalidate } from '$app/navigation'
	import * as actions from '$lib/actions'

	/**
	 * @typedef {Object} Props
	 * @property {import('$lib').Site} site
	 * @property {any} [preview]
	 * @property {string} [append]
	 */

	/** @type {Props} */
	let { site, preview = $bindable(null), append = '' } = $props()

	let container = $state()
	let scale = $state()
	let iframeHeight = $state()
	let iframe = $state()

	function resizePreview() {
		const { clientWidth: parentWidth } = container
		const { clientWidth: childWidth } = iframe
		scale = parentWidth / childWidth
		iframeHeight = `${100 / scale}%`
	}

	function append_to_iframe(code) {
		var container = document.createElement('div')

		// Set the innerHTML of the container to your HTML string
		container.innerHTML = code

		// Append each element in the container to the document head
		Array.from(container.childNodes).forEach((node) => {
			iframe.contentWindow.document.body.appendChild(node)
		})
	}

	// wait for processor to load before building preview
	let processorLoaded = false
	setTimeout(() => {
		processorLoaded = true
	}, 500)
	$effect(() => {
		iframe && append_to_iframe(append)
	})

	let added_to_library = $state([])
	let loading = $state(false)
	async function add_to_library() {
		loading = true
		const { data } = await axios.get(`https://weave-marketplace.vercel.app/api/starters/${site.id}`)
		console.log({ data })
		await actions.create_starter({
			details: {
				name: data.site.name,
				description: data.site.description
			},
			site_data: data,
			preview
		})
		invalidate('app:data')
		loading = false
		added_to_library.push(site.id)
		toast.success('Block added to Library')
	}
</script>

<svelte:window onresize={resizePreview} />

<div class="space-y-3 relative w-full bg-gray-900">
	<div class="rounded-tl rounded-tr overflow-hidden">
		<button class="w-full hover:opacity-75 transition-all" onclick={add_to_library} aria-hidden="true">
			<SitePreview {preview} {append} />
		</button>
	</div>
	<div class="absolute -bottom-2 rounded-bl rounded-br w-full p-3 z-20 bg-gray-900 truncate flex items-center justify-between">
		<div class="text-sm font-medium leading-none hover:underline">{site.name}</div>
		<Button class="h-4 p-0" onclick={add_to_library} variant="ghost" aria-label="Add to Library">
			{#if loading}
				<div class="animate-spin">
					<Loader />
				</div>
			{:else if added_to_library.includes(site.id)}
				<CircleCheck />
			{:else}
				<CirclePlus />
			{/if}
		</Button>
	</div>
</div>
