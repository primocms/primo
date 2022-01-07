import Number from './Number.svelte'
import Content from './Content.svelte'
import Switch from './Switch.svelte'
import URL from './URL.svelte'
import Link from './Link.svelte'
import Information from './Information.svelte'

export default [
  {
    id: 'content',
    label: 'Markdown',
    component: Content
  },
  {
    id: 'number',
    label: 'Number',
    component: Number
  },
  {
    id: 'switch',
    label: 'Switch',
    component: Switch
  },
  {
    id: 'url',
    label: 'URL',
    component: URL
  },
  {
    id: 'link',
    label: 'Link',
    component: Link
  },
  {
    id: 'info',
    label: 'Info',
    component: Information
  }
]