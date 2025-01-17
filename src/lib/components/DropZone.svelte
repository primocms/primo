<script lang="ts">
	import { Upload, AlertCircle } from 'lucide-svelte'

	const { onupload, class: classname = '', invalid = false } = $props()

	let file: File | null = $state(null)
	let isDragging = $state(false)
	let inputEl: HTMLInputElement

	function handleDragOver(e: DragEvent) {
		e.preventDefault()
		e.stopPropagation()
		isDragging = true
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault()
		e.stopPropagation()
		isDragging = false
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault()
		e.stopPropagation()
		isDragging = false

		const files = e.dataTransfer?.files
		if (files?.length) {
			handleFiles(files)
		}
	}

	function handleFiles(files: FileList) {
		file = files[0]
		onupload(file)
	}

	function handle_key_down(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault()
			handle_click()
		}
	}

	function handle_click() {
		inputEl?.click()
	}
</script>

<div
	role="button"
	tabindex="0"
	onclick={handle_click}
	onkeydown={handle_key_down}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	class="{classname} relative p-6 rounded-lg border-2 border-dashed
    transition-colors duration-200 ease-in-out cursor-pointer
    flex flex-col items-center justify-center gap-2
    {isDragging ? 'border-blue-500 bg-blue-500/10' : file ? 'border-green-500/50 bg-green-500/5' : 'border-gray-700 hover:border-gray-600'}"
>
	<input bind:this={inputEl} type="file" class="hidden" onchange={(e) => handleFiles(e.currentTarget.files)} accept=".json" />

	{#if invalid}
		<div class="flex flex-col items-center text-sm text-destructive">
			<AlertCircle class="h-5 w-5 mb-2" />
			<span>File invalid. Click or drop to try again.</span>
		</div>
	{:else if file}
		<div class="flex flex-col items-center text-sm text-gray-400">
			<Upload class="h-5 w-5 mb-2 text-green-500" />
			<span class="font-medium text-green-500">{file.name}</span>
			<span>Click or drop to replace</span>
		</div>
	{:else}
		<div class="flex flex-col items-center text-sm text-gray-400">
			<Upload class="h-5 w-5 mb-2" />
			<span>Drop your site file here or click to browse</span>
			<span class="text-xs text-gray-500">Accepts .json, .yaml files</span>
		</div>
	{/if}
</div>
