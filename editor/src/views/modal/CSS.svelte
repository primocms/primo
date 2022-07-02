<script>
  import {_ as C} from 'svelte-i18n'
  import { isEqual, find } from 'lodash-es';
  import { CodeMirror } from '../../components';
  import { Tabs } from '../../components/misc';
  import Preview from '../../components/misc/Preview.svelte';
  import ModalHeader from './ModalHeader.svelte';

  import activePage from '../../stores/app/activePage';
  import { saved } from '../../stores/app/misc';
  import modal from '../../stores/app/modal';
  import { updateActivePageCSS, updateSiteCSS } from '../../stores/actions';

  import { code as pageCode } from '../../stores/app/activePage';
  import {
    site,
    code as siteCode
  } from '../../stores/data/draft';
  import { buildStaticPage } from '../../stores/helpers';

  let unsavedPageCSS = $pageCode.css;
  let unsavedSiteCSS = $siteCode.css;

  let preview = '';
  updatePagePreview();
  async function updatePagePreview() {
    preview = await buildStaticPage({
      page: {
        ...$activePage,
        code: {
          ...$activePage.code,
          css: unsavedPageCSS,
        }
      },
      site: {
        ...$site,
        code: {
          ...$site.code,
          css: unsavedSiteCSS
        }
      },
    });
  }

  let loading = false;

  const primaryTabs = [
    {
      id: 'page',
      label: $C('Page'),
      icon: 'square',
    },
    {
      id: 'site',
      label: $C('Site'),
      icon: 'th',
    },
  ];

  let primaryTab =
    find(primaryTabs, ['id', localStorage.getItem('primaryTab')]) ||
    primaryTabs[0];

  $: {
    localStorage.setItem('primaryTab', primaryTab.id);
  }

  async function saveStyles() {
    updateActivePageCSS(unsavedPageCSS)
    updateSiteCSS(unsavedSiteCSS)
    $saved = false;
    modal.hide();
  }
</script>

<ModalHeader
  icon="fab fa-css3"
  title="CSS"
  button={{
    label: `Draft`,
    icon: 'fas fa-check',
    onclick: saveStyles,
    loading,
  }}
  warn={() => {
    if (
      !isEqual(unsavedPageCSS, $pageCode.css) ||
      !isEqual(unsavedSiteCSS, $siteCode.css)
    ) {
      const proceed = window.confirm(
        'Undrafted changes will be lost. Continue?'
      );
      return proceed;
    } else return true;
  }}
/>

<main>
  <div>
    <div class="editor-container">
      <Tabs tabs={primaryTabs} bind:activeTab={primaryTab} />
      {#if primaryTab.id === 'page'}
        <CodeMirror
          bind:value={unsavedPageCSS}
          mode="css"
          docs="https://docs.primo.so/development#css-1"
          debounce={true}
          on:change={updatePagePreview}
          on:save={saveStyles}
        />
      {:else if primaryTab.id === 'site'}
        <CodeMirror
          bind:value={unsavedSiteCSS}
          mode="css"
          docs="https://docs.primo.so/development#css-1"
          debounce={true}
          on:change={updatePagePreview}
          on:save={saveStyles}
        />
      {/if}
    </div>
    <div class="preview-container">
      <Preview {preview} />
    </div>
  </div>
</main>

<style lang="postcss">
  main {
    padding: 0 0.5rem;
    background: var(--primo-color-black);
    height: 100%;
    display: flex;
    flex-direction: column;

    & > div {
      display: grid;
      grid-template-columns: 50% 50%;
      flex: 1;

      .editor-container {
        display: flex;
        flex-direction: column;
        max-height: calc(100vh - 100px); /* stopgap for scrolling issue */
        overflow-y: scroll; 
      }

      .preview-container {
        height: auto;
        max-height: calc(100vh - 7rem);
        overflow: scroll;

        @media (max-width: 600px) {
          height: 24rem;
        }
      }
    }
  }
</style>
