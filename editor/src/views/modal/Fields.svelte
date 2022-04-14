<script>
  import { cloneDeep, isEqual, chain as _chain } from 'lodash-es';
  import { _ as C } from 'svelte-i18n';
  import { Tabs } from '../../components/misc';
  import Preview from '../../components/misc/Preview.svelte';
  import {getEmptyValue} from '../../utils'

  import ModalHeader from './ModalHeader.svelte';
  import { showingIDE } from '../../stores/app';
  import { locale } from '../../stores/app/misc';
  import { saveFields } from '../../stores/actions';
  import modal from '../../stores/app/modal';
  import activePage, { id as pageID, fields as pageFields } from '../../stores/app/activePage';
  import site, { fields as siteFields, content } from '../../stores/data/draft';
  import { buildStaticPage } from '../../stores/helpers';

  import GenericFields from '../../components/GenericFields.svelte';

  let localContent = cloneDeep($content)

  let localPageFields = cloneDeep($pageFields).map(field => ({
    ...field,
    value: localContent[$locale][$pageID][field.key]
  }));
  let localSiteFields = cloneDeep($siteFields).map(field => ({
    ...field,
    value: localContent[$locale][field.key]
  }));

  $: showPageFields = localPageFields.length > 0;

  $: syncLocales($content)
  function syncLocales(content) {
    // runs when adding new locale from Fields
    Object.keys(content).forEach((loc) => {
      if (!localContent[loc]) {
        localContent = {
          ...localContent,
          [loc]: localContent['en']
        }
      }
    })
  }

  $: $locale, setupFields()
  function setupFields() {
    localPageFields = getFieldValues(localPageFields, 'page')
    localSiteFields = getFieldValues(localSiteFields, 'site')
  }

  function getFieldValues(fields, context) {
    return fields.map(field => ({
      ...field,
      value: (context === 'site' ? localContent[$locale][field.key] : localContent[$locale][$pageID][field.key]) || getEmptyValue(field)
    }))
  }

  function saveLocalContent() {
    // TODO: use _set to mutate the object instead of reassigning it on every keypress
    localContent = {
      ...localContent,
      [$locale]: {
        ...localContent[$locale],
        ..._chain(localSiteFields).keyBy('key').mapValues('value').value(),
        [$pageID]: {
          ...localContent[$locale][$pageID],
          ..._chain(localPageFields).keyBy('key').mapValues('value').value()
        }
      }
    }
    updatePagePreview()
    console.log(localContent)
  }

  const tabs = [
    {
      label: $C('Page'),
      icon: 'square',
    },
    {
      label: $C('Site'),
      icon: 'th',
    },
  ];
  let activeTab = showPageFields ? tabs[0] : tabs[1];

  let showingPage = true;
  $: showingPage = (showPageFields || $showingIDE) && (activeTab === tabs[0]);
  
  function applyFields() {
    console.log({localContent, localSiteFields})
    saveFields(localPageFields, localSiteFields, localContent)
    modal.hide();
  }

  let preview = ''
  updatePagePreview()
  async function updatePagePreview() {
    preview = await buildStaticPage({
      page: {
        ...$activePage,
      },
      site: {
        ...$site,
        content: localContent
      },
    });
  }


</script>

<ModalHeader
  icon="fas fa-database"
  title={$showingIDE ? 'Fields' : 'Content'}
  button={{ label: `Draft`, icon: 'fas fa-check', onclick: applyFields }}
  warn={() => {
    if (!isEqual(localPageFields, $pageFields) || !isEqual(localSiteFields, $siteFields)) {
      const proceed = window.confirm('Undrafted changes will be lost. Continue?');
      return proceed;
    } else return true;
  }} />

<main>
  <div>
    <div class="editor-container">
      {#if showPageFields || $showingIDE}
        <Tabs {tabs} bind:activeTab />
      {/if}
      {#if showingPage}
        <GenericFields bind:fields={localPageFields} on:input={saveLocalContent}/>
      {:else}
        <GenericFields bind:fields={localSiteFields} on:input={saveLocalContent} />
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
