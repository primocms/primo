<script>
  import Mousetrap from 'mousetrap';
  import _ from 'lodash-es';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  import Toolbar from './Toolbar.svelte';
  import ToolbarButton from './ToolbarButton.svelte';
  import Doc from './Doc.svelte';

  import { currentPagePreview } from '../../components/misc/misc';
  import site from '../../stores/data/site';
  import { focusedNode, switchEnabled } from '../../stores/app';
  import { undone } from '../../stores/data/draft';
  import { saving, unsaved, loadingSite } from '../../stores/app/misc';
  import modal from '../../stores/app/modal';
  import { undoSiteChange, redoSiteChange } from '../../stores/actions';
  import currentPage, { id, content } from '../../stores/app/activePage';

  import { buildStaticPage } from '../../stores/helpers';
  let unlockingPage = false;
  let updatingDatabase = false;

  // setup key-bindings
  Mousetrap.bind(['mod+s'], (e) => {
    e.preventDefault();
    savePage();
  });

  const editorButtons = [
    [
      {
        id: 'pages',
        title: 'Pages',
        icon: 'th-large',
        onclick: () => modal.show('SITE_PAGES'),
      },
    ],
    [
      {
        title: 'Content',
        icon: 'database',
        onclick: () => modal.show('FIELDS'),
      },
    ],
  ];

  const developerButtons = [
    [
      {
        id: 'toolbar--pages',
        title: 'Pages',
        icon: 'th-large',
        onclick: () => modal.show('SITE_PAGES'),
      },
    ],
    [
      {
        id: 'toolbar--components',
        title: 'Component Library',
        icon: 'clone',
        onclick: () => modal.show('SYMBOL_LIBRARY'),
      },
    ],
    [
      {
        id: 'toolbar--html',
        title: 'HTML',
        icon: 'fab fa-html5',
        onclick: () => modal.show('WRAPPER'),
      },
      {
        id: 'toolbar--css',
        title: 'CSS',
        icon: 'fab fa-css3',
        onclick: () => modal.show('STYLES'),
      },
      {
        id: 'toolbar--fields',
        title: 'Fields',
        icon: 'database',
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

  $: toolbarButtons = $switchEnabled ? developerButtons : editorButtons;

  // Show 'are you sure you want to leave prompt' when closing window
  $: if ($unsaved && window.location.hostname !== 'localhost') {
    window.onbeforeunload = function (e) {
      e.returnValue = '';
    };
  } else {
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
  on:toggleView={() => switchEnabled.set(!$switchEnabled)}>
  <ToolbarButton
    id="undo"
    title="Undo"
    icon="undo-alt"
    on:click={undoSiteChange}
    buttonStyles="mr-1 bg-gray-600" />
  {#if $undone.length > 0}
    <ToolbarButton
      id="redo"
      title="Redo"
      icon="redo-alt"
      on:click={redoSiteChange}
      buttonStyles="mr-1 bg-gray-600" />
  {/if}
  <ToolbarButton
    id="save"
    title="Save"
    icon="save"
    key="s"
    loading={$saving}
    on:click={savePage}
    disabled={!$unsaved} />
  <ToolbarButton
    type="primo"
    title="Publish"
    label="Publish"
    icon="fas fa-globe"
    style="margin-left:10px"
    hideTooltip={true}
    active={false}
    on:click={() => modal.show('BUILD')}
    disabled={updatingDatabase} />
</Toolbar>

<Doc bind:element={page} />
