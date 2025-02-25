import { writable } from 'svelte/store';
import { cloneDeep } from 'lodash-es';

export function createStack(current) {
	/** @type {T[]} */
	let stack = [current];

	let index = stack.length;

	const state = writable({
		first: true,
		last: true,
		current,
	});

	function update() {
		current = stack[index - 1];

		state.set({
			first: index === 1,
			last: index === stack.length,
			current,
		});

		return current;
	}

	return {
		set: value => {
			stack = [value];
			index = 1;
			return update();
		},
		/** @param {T | ((current: T) => T)} value */
		push: value => {
			stack.length = index;
			stack[index++] = cloneDeep(value);
			return update();
		},
		undo: () => {
			if (index > 1) index -= 1;
			return update();
		},
		redo: () => {
			if (index < stack.length) index += 1;
			return update();
		},
		subscribe: state.subscribe,
	};
}
