<script>
  import { _ as C } from 'svelte-i18n'
  import * as Mousetrap from 'mousetrap'
  import { createEventDispatcher, onMount } from 'svelte'

  const dispatch = createEventDispatcher()

  import Toolbar from './Toolbar.svelte'
  import ToolbarButton from './ToolbarButton.svelte'

  import { showingIDE } from '../../stores/app'
  import { fields as siteFields, timeline } from '../../stores/data/draft'
  import { fields as pageFields, sections } from '../../stores/app/activePage'
  import { saving, saved, loadingSite } from '../../stores/app/misc'
  import modal from '../../stores/app/modal'
  import {
    undoSiteChange,
    redoSiteChange,
    changeLocale,
  } from '../../stores/actions'

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

  $: editorButtons = [
    [
      {
        id: 'pages',
        title: $C('Pages'),
        label: $C('Pages'),
        icon: 'fa-solid:th-large',
        onclick: () =>
          modal.show('SITE_PAGES', {}, { hideLocaleSelector: true }),
        showSwitch: false,
      },
    ],
    hasFields
      ? [
          {
            icon: 'bxs:edit',
            title: $C('Content'),
            label: $C('Content'),
            onclick: () =>
              modal.show(
                'FIELDS',
                {},
                {
                  showSwitch: true,
                }
              ),
          },
        ]
      : [],
  ]

  const developerButtons = [
    [
      {
        id: 'toolbar--pages',
        label: $C('Pages'),
        title: $C('Pages'),
        icon: 'fa-solid:th-large',
        onclick: () =>
          modal.show('SITE_PAGES', {}, { hideLocaleSelector: true }),
        showSwitch: false,
      },
    ],
    [
      {
        id: 'toolbar--html',
        title: 'HTML',
        label: 'HTML',
        icon: 'icomoon-free:html-five2',
        onclick: () => modal.show('WRAPPER'),
      },
      {
        id: 'toolbar--css',
        title: 'CSS',
        label: 'CSS',
        icon: 'ci:css3',
        onclick: () => modal.show('STYLES'),
      },
      {
        id: 'toolbar--fields',
        title: $C('Fields'),
        label: $C('Fields'),
        icon: 'bxs:edit',
        onclick: () =>
          modal.show(
            'FIELDS',
            {},
            {
              showSwitch: true,
            }
          ),
      },
    ],
  ]

  function savePage() {
    dispatch('save')
  }

  $: toolbarButtons = $showingIDE ? developerButtons : editorButtons
</script>

<Toolbar on:signOut buttons={$loadingSite ? [] : developerButtons}>
  {#if !$timeline.first}
    <ToolbarButton
      id="undo"
      title="Undo"
      icon="undo"
      on:click={undoSiteChange}
    />
  {/if}
  {#if !$timeline.last}
    <ToolbarButton
      id="redo"
      title="Redo"
      icon="redo"
      on:click={redoSiteChange}
    />
  {/if}
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
    icon="globe"
    style="margin-left:0.25rem;"
    active={false}
    on:click={() => modal.show('BUILD')}
    disabled={pageEmpty}
  />
</Toolbar>
