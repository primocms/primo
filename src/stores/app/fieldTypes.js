import {writable} from 'svelte/store'
import ContentField from '../../components/FieldTypes/ContentField.svelte'
import RepeaterField from '../../components/FieldTypes/RepeaterField.svelte'
import GroupField from '../../components/FieldTypes/GroupField.svelte'

const fieldTypes = writable([
  {
    id: 'text',
    label: 'Text',
    component: ContentField
  },
  {
    id: 'repeater',
    label: 'Repeater',
    component: RepeaterField
  },
  {
    id: 'group',
    label: 'Group',
    component: GroupField
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