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
  register: (newType) => {
    fieldTypes.update(types => [
      ...types,
      newType
    ])
  },
  set: fieldTypes.set,
  subscribe: fieldTypes.subscribe
}