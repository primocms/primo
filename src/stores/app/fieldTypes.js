import {writable} from 'svelte/store'
import TextField from '../../components/FieldTypes/ContentField.svelte'

const fieldTypes = writable([
  {
    id: 'text',
    label: 'Text',
    component: TextField
  }
])

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