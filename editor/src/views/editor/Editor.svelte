<script>
  import * as Mousetrap from 'mousetrap';
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/env';

  const dispatch = createEventDispatcher();

  import Toolbar from './Toolbar.svelte';
  import ToolbarButton from './ToolbarButton.svelte';
  import Doc from './Doc.svelte';

  import { showingIDE } from '../../stores/app';
  import { undone, fields as siteFields } from '../../stores/data/draft';
  import { fields as pageFields, sections } from '../../stores/app/activePage';
  import { saving, saved, loadingSite } from '../../stores/app/misc';
  import modal from '../../stores/app/modal';
  import { undoSiteChange, redoSiteChange } from '../../stores/actions';

  $: pageEmpty = $sections && $sections.length <= 1 && $sections.length > 0 && $sections[0]['type'] === 'options';

  // setup key-bindings
  onMount(() => {
    Mousetrap.bind(['mod+s'], (e) => {
      e.preventDefault();
      savePage();
    });
  });

  $: hasFields = $siteFields ? [...$siteFields, ...$pageFields].length > 0 : false

  $: editorButtons = [
    [
      {
        id: 'pages',
        title: 'Pages',
        label: 'Pages',
        icon: 'pages',
        onclick: () => modal.show('SITE_PAGES'),
      },
    ],
    hasFields ? [
      {
        title: 'Content',
        label: 'Content',
        onclick: () => modal.show('FIELDS'),
      },
    ] : [],
  ];

  const developerButtons = [
    [
      {
        id: 'toolbar--pages',
        label: 'Pages',
        title: 'Pages',
        icon: 'pages',
        onclick: () => modal.show('SITE_PAGES'),
      },
    ],
    [
      {
        id: 'toolbar--components',
        title: 'Component Library',
        label: 'Components',
        icon: 'clone',
        onclick: () => modal.show('SYMBOL_LIBRARY'),
      },
    ],
    [
      {
        id: 'toolbar--html',
        title: 'HTML',
        label: 'HTML',
        onclick: () => modal.show('WRAPPER'),
      },
      {
        id: 'toolbar--css',
        title: 'CSS',
        label: 'CSS',
        onclick: () => modal.show('STYLES'),
      },
      {
        id: 'toolbar--fields',
        title: 'Fields',
        label: 'Fields',
        onclick: () => modal.show('FIELDS'),
      },
    ],
    // [
    //   {
    //     id: 'toolbar--preview',
    //     title: 'Preview',
    //     icon: 'window-restore',
    //     onclick: async () => {
    //       // window.open('http://localhost:3333', '_blank');
    //       // var wnd = window.open('about:blank', '', '_blank');
    //       // wnd.document.write(iframePreview);
    //       const w = window.open(
    //         'data:text/html;charset=utf-8,' + currentPagePreview,
    //         '',
    //         '_blank'
    //       );
    //       const preview = await buildStaticPage({
    //         page: $currentPage,
    //         site: $site,
    //       });
    //       console.log({ preview });
    //       console.log({ w });
    //       w.postMessage({ html: preview });
    //       // setTimeout(() => {
    //       //   w.postMessage({ html: preview });
    //       // }, 0);
    //     },
    //   },
    // ],
  ];

  function savePage() {
    dispatch('save');
  }

  $: toolbarButtons = $showingIDE ? developerButtons : editorButtons;

  // Show 'are you sure you want to leave prompt' when closing window
  $: if (browser && !$saved && window.location.hostname !== 'localhost') {
    window.onbeforeunload = function (e) {
      e.returnValue = '';
    };
  } else if (browser) {
    window.onbeforeunload = function (e) {
      delete e['returnValue'];
    };
  }

  // Add top margin to page since toolbar is fixed
  let toolbar;
  let page;
  $: if (toolbar && page) {
    page.style.borderTop = `${
      toolbar.clientHeight + 2
    }px solid var(--primo-color-black)`;
  }
</script>

<Toolbar
  bind:element={toolbar}
  on:signOut
  buttons={$loadingSite ? [] : toolbarButtons}
  on:toggleView={() => showingIDE.set(!$showingIDE)}
>
  <ToolbarButton
    id="undo"
    title="Undo"
    icon="undo"
    on:click={undoSiteChange}
  />
  {#if $undone.length > 0}
    <ToolbarButton
      id="redo"
      title="Redo"
      icon="redo"
      on:click={redoSiteChange}
    />
  {/if}
  <ToolbarButton
    id="save"
    title="Save"
    icon="save"
    key="s"
    loading={$saving}
    on:click={savePage}
    disabled={$saved}
  />
  <ToolbarButton
    type="primo"
    title={pageEmpty ? 'Add a content block or component to your page to publish it' : 'Publish'}
    label="Publish"
    icon="globe"
    style="margin-left:0.25rem;"
    active={false}
    on:click={() => modal.show('BUILD')}
    disabled={pageEmpty}
  />
</Toolbar>

<Doc bind:element={page} on:save />
