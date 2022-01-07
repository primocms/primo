<script>
  import { find, some, isEqual } from 'lodash-es';
  import * as Mousetrap from 'mousetrap';

  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import Editor from './views/editor/Editor.svelte';
  import Modal from './views/modal/ModalContainer.svelte';
  import modal from './stores/app/modal';
  import * as modals from './views/modal';

  const dispatch = createEventDispatcher();

  import librariesStore from './stores/data/libraries';
  import { id as pageId } from './stores/app/activePage';
  import { sections, fields, html, css } from './stores/app/activePage';
  import { userRole } from './stores/app';
  import {
    saved,
    saving as savingStore,
    showKeyHint,
    loadingSite,
  } from './stores/app/misc';
  import { DEFAULTS, Site } from './const';
  import {resetActivePage} from './stores/helpers'

  import { pages } from './stores/data/draft';
  import { site as draft } from './stores/data/draft';
  import { hydrateSite } from './stores/actions';
  import { page as pageStore } from '$app/stores';

  export let data = Site();
  export let libraries = [];
  export let role = 'developer';
  export let saving = false;
  $: $savingStore = saving;

  // $: $showingIDE = role === 'developer' ? true : false;
  $: $userRole = role;
  $: $librariesStore = libraries;

  function saveSite() {
    dispatch('save', $draft);
  }

  // refresh draft data when passing in updated data
  let cachedData;
  $: if (!isEqual(cachedData, data)) {
    cachedData = data;
    hydrateSite(data);
  }

  $: $pageId = getPageId($pageStore.params);
  function getPageId(params) {
    const { site, page = 'index' } = params;
    const [root, child] = page.split('/');
    return child ? `${root}/${child}` : root;
  }

  $: setPageContent($pageId, $pages);
  function setPageContent(id, pages) {
    const [root, child] = id.split('/');
    const rootPage = find(pages, ['id', root]);
    if (rootPage && !child) {
      setPageStore(rootPage);
    } else if (rootPage && child) {
      const childPage = find(rootPage.pages, ['id', id]);
      setPageStore(childPage);
    } else {
      console.warn('Could not navigate to page', id);
    }

    function setPageStore(page) {
      sections.set(page.sections);
      fields.set(page.fields);
      html.set(page.html || DEFAULTS.html);
      css.set(page.css || DEFAULTS.css);
    }
  }

  $: activeModal = getActiveModal($modal.type);
  function getActiveModal(modalType) {
    return modalType
      ? {
          SITE_PAGES: modals.SitePages,
          COMPONENT_EDITOR: modals.ComponentEditor,
          SYMBOL_LIBRARY: modals.SymbolLibrary,
          FIELDS: modals.Fields,
          WRAPPER: modals.HTML,
          STYLES: modals.CSS,
        }[modalType] || $modal.component
      : null;
  }

  $: $loadingSite = checkFor404($pageId, $pages);
  function checkFor404(id, pages) {
    const [root, child] = id.split('/');
    const exists = some(pages, ['id', root]) || some(pages, ['id', child]);
    return !exists;
  }

  onMount(() => {
    Mousetrap.bind('command', () => ($showKeyHint = true), 'keydown');
    Mousetrap.bind('command', () => ($showKeyHint = false), 'keyup');

    return () => {
      resetActivePage()
    }
  });
</script>

<Editor on:save={saveSite} />

<Modal visible={!!activeModal}>
  <svelte:component this={activeModal} {...$modal.componentProps} />
</Modal>

<svelte:head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" integrity="sha512-1ycn6IcaQQ40/MKBW2W4Rhis/DbILU74C1vSrLJxCq57o941Ym01SwNsOMqvEBFlcgUa6xLiPY/NS5R+E6ztJQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />
</svelte:head>

<style>
  :global(:root) {
    --primo-color-primored: rgb(248, 68, 73);
    --primo-color-primored-dark: rgb(186, 37, 42);
    --primo-color-white: white;
    --primo-color-codeblack: rgb(30, 30, 30);
    --primo-color-codeblack-opaque: rgba(30, 30, 30, 0.9);

    --primo-border-radius: 4px;

    --primo-color-black: rgb(17, 17, 17);
    --primo-color-black-opaque: rgba(17, 17, 17, 0.9);

    --color-gray-1: rgb(245, 245, 245);
    --color-gray-2: rgb(229, 229, 229);
    --color-gray-3: rgb(212, 212, 212);
    --color-gray-4: rgb(156, 163, 175);
    --color-gray-5: rgb(115, 115, 115);
    --color-gray-6: rgb(82, 82, 82);
    --color-gray-7: rgb(64, 64, 64);
    --color-gray-8: rgb(38, 38, 38);
    --color-gray-9: rgb(23, 23, 23);

    --font-size-1: 0.75rem;
    --font-size-2: 0.875rem;
    --font-size-3: 1.125rem;
    --font-size-4: 1.25rem;

    box-shadow: 0 0 #0000 0 0 #0000, 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    --box-shadow-xl: 0 0 #0000, 0 0 #0000, 0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);

    --transition-colors: background-color 0.1s, border-color 0.1s, color 0.1s,
      fill 0.1s, stroke 0.1s;

    --padding-container: 15px;
    --max-width-container: 1900px;

    --ring: 0px 0px 0px 2px var(--primo-color-primored);
  }

</style>
