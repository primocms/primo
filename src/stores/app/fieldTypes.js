import {writable} from 'svelte/store'
import ContentField from '../../components/FieldTypes/ContentField.svelte'
import TextAreaField from '../../components/FieldTypes/TextAreaField.svelte'
import RepeaterField from '../../components/FieldTypes/RepeaterField.svelte'
import GroupField from '../../components/FieldTypes/GroupField.svelte'

const fieldTypes = writable([
  {
    id: 'content',
    label: 'Text Area',
    component: TextAreaField
  },
  {
    id: 'number',
    label: 'Number',
    component: ContentField
  },
  {
    id: 'url',
    label: 'URL',
    component: ContentField
  },
  {
    id: 'checkbox',
    label: 'True / False',
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
  },
  {
    id: 'text',
    label: 'Text',
    component: ContentField
  },
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