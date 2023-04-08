<script>
  import { _ as C } from 'svelte-i18n'
  import * as Mousetrap from 'mousetrap'
  import { createEventDispatcher, onMount } from 'svelte'

  const dispatch = createEventDispatcher()

  import Toolbar from './Toolbar.svelte'
  import ToolbarButton from './ToolbarButton.svelte'
  import { fields as siteFields } from '../../stores/data/draft'
  import { fields as pageFields } from '../../stores/app/activePage'
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
    // Save page
    Mousetrap.bind(['mod+s'], (e) => {
      e.preventDefault()
      savePage()
    })

    // Change locale
    Mousetrap.bind(['mod+l'], (e) => {
      e.preventDefault()
      changeLocale()
    })
  })

  $: hasFields = $siteFields
    ? [...$siteFields, ...$pageFields].length > 0
    : false

  const developerButtons = [
    {
      id: 'toolbar--pages',
      title: $C('Pages'),
      svg: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.5" y="2.5" width="5" height="5" rx="0.5" fill="#CECECE" stroke="#CECECE"/><rect x="10.5" y="2.5" width="5" height="5" rx="0.5" fill="#CECECE" stroke="#CECECE"/><rect x="2.5" y="10.5" width="5" height="5" rx="0.5" fill="#CECECE" stroke="#CECECE"/><rect x="10.5" y="10.5" width="5" height="5" rx="0.5" fill="#CECECE" stroke="#CECECE"/></svg>',
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

  function savePage() {
    dispatch('save')
  }
</script>

<Toolbar on:signOut buttons={$loadingSite ? [] : developerButtons}>
  <!-- <ToolbarButton
    id="save"
    title="Save"
    icon="save"
    key="s"
    loading={$saving}
    on:click={savePage}
    disabled={$saved}
  /> -->
  <ToolbarButton
    type="primo"
    title={pageEmpty
      ? 'Add a content block or component to your page to publish it'
      : 'Publish'}
    label={$C('Publish')}
    active={false}
    on:click={() =>
      modal.show('DEPLOY', {}, { maxWidth: '400px', hideLocaleSelector: true })}
    disabled={pageEmpty}
  />
</Toolbar>
