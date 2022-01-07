<script>
  import '$lib/assets/reset.css'
  import { browser } from '$app/env'
  import ImageField from '../extensions/FieldTypes/ImageField.svelte'
  import SiteButtons from '$lib/components/SiteButtons.svelte'
  import {
    dropdown,
    registerProcessors,
    fieldTypes,
    PrimoFieldTypes,
  } from '@primo-app/primo'
  import * as primo from '@primo-app/primo/package.json'
  import * as desktop from '../../package.json'

  if (browser) {
    import('../compiler/processors').then(({ html, css }) => {
      registerProcessors({ html, css })
    })
  }

  fieldTypes.register([
    {
      id: 'image',
      label: 'Image',
      component: ImageField,
    },
    ...PrimoFieldTypes,
  ])

  dropdown.set([
    {
      label: 'Back to Dashboard',
      icon: 'fas fa-arrow-left',
      href: '/',
    },
    {
      component: SiteButtons,
    },
  ])
</script>

<div id="primo-desktop-toolbar" />
<slot />
<div id="app-version">
  <span>desktop v{desktop.version}</span>
  <span>primo v{primo.version}</span>
</div>

<style>
  #primo-desktop-toolbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 30px;
    -webkit-app-region: drag;
    border-bottom: 1px solid #222;
    background: var(--primo-color-black);
    z-index: 1;
  }
  #app-version {
    font-family: 'Satoshi', sans-serif;
    font-size: 0.75rem;
    color: var(--color-gray-4);
    position: fixed;
    bottom: 0.5rem;
    left: 0.5rem;

    span:first-child {
      margin-right: 0.5rem;
    }
  }
</style>
