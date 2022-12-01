import {writable} from 'svelte/store'
import buildInFieldTypes from '../../field-types'

const fieldTypes = writable(buildInFieldTypes)

export default {
  register: (userTypes) => {
    fieldTypes.update(types => [
      ...types,
      ...userTypes
    ])
  },
  set: fieldTypes.set,
  subscribe: fieldTypes.subscribe
}