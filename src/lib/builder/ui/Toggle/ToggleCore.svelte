<script>
	/**
	 * @typedef {Object} Props
	 * @property {any} [id] - Specify the id
	 * @property {boolean} [toggled] - Specify whether the toggle switch is toggled
	 * @property {boolean} [disabled] - Set to `true` to disable the button
	 * @property {import('svelte').Snippet<[any]>} [children]
	 */

	/** @type {Props & { [key: string]: any }} */
	let { id = 'toggle' + Math.random().toString(36), toggled = $bindable(true), disabled = false, children, ...rest } = $props()

	let label = $derived({ for: id })
	let button = $derived({
		...rest,
		id,
		disabled,
		'aria-checked': toggled,
		type: 'button',
		role: 'switch'
	})
</script>

{@render children?.({ label, button })}
