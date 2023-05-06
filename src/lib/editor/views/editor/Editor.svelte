<script>
  import { _ as C } from 'svelte-i18n'
  import * as Mousetrap from 'mousetrap'
  import { createEventDispatcher, onMount } from 'svelte'

  const dispatch = createEventDispatcher()

  import Toolbar from './Toolbar.svelte'
  import ToolbarButton from './ToolbarButton.svelte'
  import sections from '../../stores/data/sections'
  import { loadingSite } from '../../stores/app/misc'
  import modal from '../../stores/app/modal'
  import { changeLocale } from '../../stores/actions'

  $: pageEmpty =
    $sections &&
    $sections.length <= 1 &&
    $sections.length > 0 &&
    $sections[0]['type'] === 'options'

  // setup key-bindings
  onMount(() => {
    // Change locale
    Mousetrap.bind(['mod+l'], (e) => {
      e.preventDefault()
      changeLocale()
    })
  })

  const developerButtons = [
    {
      id: 'toolbar--pages',
      title: $C('Pages'),
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M10 19q-.425 0-.713-.288T9 18q0-.425.288-.713T10 17h10q.425 0 .713.288T21 18q0 .425-.288.713T20 19H10Zm0-6q-.425 0-.713-.288T9 12q0-.425.288-.713T10 11h10q.425 0 .713.288T21 12q0 .425-.288.713T20 13H10Zm0-6q-.425 0-.713-.288T9 6q0-.425.288-.713T10 5h10q.425 0 .713.288T21 6q0 .425-.288.713T20 7H10ZM5 20q-.825 0-1.413-.588T3 18q0-.825.588-1.413T5 16q.825 0 1.413.588T7 18q0 .825-.588 1.413T5 20Zm0-6q-.825 0-1.413-.588T3 12q0-.825.588-1.413T5 10q.825 0 1.413.588T7 12q0 .825-.588 1.413T5 14Zm0-6q-.825 0-1.413-.588T3 6q0-.825.588-1.413T5 4q.825 0 1.413.588T7 6q0 .825-.588 1.413T5 8Z"/></svg>',
      onclick: () =>
        modal.show(
          'SITE_PAGES',
          {},
          { hideLocaleSelector: true, maxWidth: '600px' }
        ),
      showSwitch: false,
    },
    [
      {
        id: 'toolbar--page',
        title: 'Page',
        label: 'Page',
        svg: '<svg width="10" height="16" viewBox="0 0 12 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0.425" y="0.925" width="10.4834" height="14.15" rx="1.575" fill="#121212"/><rect x="2.41675" y="3.625" width="2" height="2" fill="#D9D9D9"/><rect x="2.41675" y="7.125" width="6" height="0.75" fill="#D9D9D9"/><rect x="2.41675" y="9.375" width="5" height="0.75" fill="#D9D9D9"/><rect x="2.41675" y="11.625" width="6.5" height="0.75" fill="#D9D9D9"/><rect x="0.425" y="0.925" width="10.4834" height="14.15" rx="1.575" stroke="#CECECE" stroke-width="0.85"/></svg>',
        onclick: () => modal.show('PAGE_EDITOR', {}, { showSwitch: true }),
      },
      {
        id: 'toolbar--site',
        svg: `<svg width="12" height="18" viewBox="0 0 15 18" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.50831" y="0.925" width="10.4834" height="13.3167" rx="1.575" fill="#121212"/><rect x="3.50831" y="0.925" width="10.4834" height="13.3167" rx="1.575" stroke="#CECECE" stroke-width="0.85"/><rect x="2.09169" y="2.34199" width="10.4834" height="13.3167" rx="1.575" fill="#121212"/><rect x="2.09169" y="2.34199" width="10.4834" height="13.3167" rx="1.575" stroke="#CECECE" stroke-width="0.85"/><rect x="0.675" y="3.75801" width="10.4834" height="13.3167" rx="1.575" fill="#121212"/><rect x="2.66669" y="6.4165" width="2" height="2" fill="#D9D9D9"/><rect x="2.66669" y="9.6665" width="5.75" height="0.75" fill="#D9D9D9"/><rect x="2.66669" y="11.6665" width="5" height="0.75" fill="#D9D9D9"/><rect x="2.66669" y="13.6665" width="6.5" height="0.75" fill="#D9D9D9"/><rect x="0.675" y="3.75801" width="10.4834" height="13.3167" rx="1.575" stroke="#CECECE" stroke-width="0.85"/></svg>`,
        title: 'Site',
        label: 'Site',
        onclick: () => modal.show('SITE_EDITOR', {}, { showSwitch: true }),
      },
    ],
  ]
</script>

<Toolbar on:signOut buttons={$loadingSite ? [] : developerButtons}>
  <ToolbarButton
    type="primo"
    title={pageEmpty
      ? 'Add a content block or component to your page to publish it'
      : 'Publish'}
    label="Deploy"
    active={false}
    on:click={() =>
      modal.show('DEPLOY', {}, { maxWidth: '450px', hideLocaleSelector: true })}
    disabled={pageEmpty}
  />
</Toolbar>
