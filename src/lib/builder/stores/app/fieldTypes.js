import { writable } from 'svelte/store'
import buildInFieldTypes from '../../field-types/index.js'

const fieldTypes = writable(buildInFieldTypes)

export default {
	register: (userTypes) => {
		fieldTypes.update((types) => [...types, ...userTypes])
	},
	set: fieldTypes.set,
	subscribe: fieldTypes.subscribe
}
