import { get } from 'svelte/store'
import { timeline } from '$lib/builder/stores/data'
import _ from 'lodash-es'


// TIMELINE

/** @returns {void} */
export function undo_change() {
	const { current } = get(timeline)
	current?.undoing(current.data)
	timeline.undo()
}

/** @returns {void} */
export function redo_change() {
	const { data, doing } = timeline.redo()
	doing(data)
}
