<script>
	import autosize from 'autosize'
	import { onMount } from 'svelte'
	import { createEventDispatcher } from 'svelte'
	import TextInput from '../ui/TextInput.svelte'

	const dispatch = createEventDispatcher()

	/**
	 * @typedef {Object} Props
	 * @property {any} field
	 * @property {any} value
	 * @property {boolean} [disabled]
	 * @property {any} [title]
	 * @property {boolean} [autofocus]
	 * @property {() => void} [onkeydown]?
	 * @property {() => void} [oninput]?
	 */

	/** @type {Props} */
	let { field, value, disabled = false, title = null, autofocus = false, onkeydown, oninput } = $props()

	let element
	onMount(() => {
		autosize(element)
	})
</script>

<TextInput {...field} {value} {disabled} {title} grow={true} {autofocus} {onkeydown} oninput={(text) => oninput({ value: text })} />

<style lang="postcss">
</style>
