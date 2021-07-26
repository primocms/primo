<script>
  import { cloneDeep, isEqual } from 'lodash';
  import { CodeMirror } from '../../components';
  import { Tabs } from '../../components/misc';
  import Preview from '../../components/misc/Preview.svelte';
  import { wrapInStyleTags, processCode } from '../../utils';
  import ModalHeader from './ModalHeader.svelte';
  import { processors } from '../../component';

  import activePage, { content, id } from '../../stores/app/activePage';
  import { unsaved } from '../../stores/app/misc';
  import modal from '../../stores/app/modal';
  import { pages } from '../../stores/actions';

  import { css as pageCSS } from '../../stores/app/activePage';
  import {
    site,
    pages as pagesStore,
    css as siteCSS,
  } from '../../stores/data/draft';
  import { buildStaticPage } from '../../stores/helpers';

  let unsavedPageCSS = $pageCSS;
  let unsavedSiteCSS = $siteCSS;

  let preview = '';
  getNewPagePreview();
  async function getNewPagePreview() {
    preview = await buildStaticPage({
      page: {
        ...$activePage,
        css: unsavedPageCSS,
      },
      site: $site,
    });
  }

  let allPages = [];
  buildSitePreview();
  async function buildSitePreview() {
    allPages = await Promise.all(
      $pagesStore.map((page) =>
        buildStaticPage({
          page,
          site: {
            ...$site,
            css: unsavedSiteCSS,
          },
        })
      )
    );
  }

  let loading = false;

  const primaryTabs = [
    {
      id: 'page',
      label: 'Page',
      icon: 'square',
    },
    {
      id: 'site',
      label: 'Site',
      icon: 'th',
    },
  ];

  let primaryTab = primaryTabs[0];

  const secondaryTabs = [
    {
      id: 'styles',
      label: 'CSS',
    },
    {
      id: 'tw',
      label: 'Tailwind Config',
    },
  ];

  let secondaryTab = secondaryTabs[0];

  let view = 'large';

  async function saveStyles() {
    $siteCSS = unsavedSiteCSS;
    pages.update($id, (page) => ({
      ...page,
      css: unsavedPageCSS,
    }));
    $unsaved = true;
    modal.hide();
  }

</script>

<ModalHeader
  icon="fab fa-css3"
  title="CSS"
  button={{ label: `Draft`, icon: 'fas fa-check', onclick: saveStyles, loading }}
  warn={() => {
    if (!isEqual(unsavedPageCSS, $pageCSS) || !isEqual(unsavedSiteCSS, $siteCSS)) {
      const proceed = window.confirm('Undrafted changes will be lost. Continue?');
      return proceed;
    } else return true;
  }}
  variants="mb-4" />

<div class="h-full flex flex-col">
  <div class="grid md:grid-cols-2 flex-1">
    <div class="flex flex-col">
      <Tabs tabs={primaryTabs} bind:activeTab={primaryTab} variants="mb-2" />
      <!-- <Tabs tabs={secondaryTabs} bind:activeTab={secondaryTab} variants="secondary" /> -->
      {#if primaryTab.id === 'page'}
        <CodeMirror
          autofocus
          bind:value={unsavedPageCSS}
          mode="css"
          docs="https://adam-marsden.co.uk/css-cheat-sheet"
          debounce={true}
          on:debounce={getNewPagePreview}
          on:save={saveStyles} />
      {:else if primaryTab.id === 'site'}
        <CodeMirror
          autofocus
          bind:value={unsavedSiteCSS}
          mode="css"
          docs="https://adam-marsden.co.uk/css-cheat-sheet"
          debounce={true}
          on:debounce={buildSitePreview}
          on:save={saveStyles} />
      {/if}
    </div>
    <div class="h-96 md:h-auto">
      {#if primaryTab.id === 'page'}
        <Preview {preview} />
      {:else}
        {#each allPages as preview}
          <Preview {preview} />
        {/each}
      {/if}
    </div>
  </div>
</div>
