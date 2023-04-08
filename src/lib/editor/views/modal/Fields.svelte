<script context="module">
  import { writable, get } from 'svelte/store'

  const leftPaneSize = writable(get(onMobile) ? '100%' : '50%')
  const rightPaneSize = writable('50%')
  const activeTab = writable(0)
</script>

<script>
  import { cloneDeep, isEqual, chain as _chain, debounce } from 'lodash-es'
  import { _ as C } from 'svelte-i18n'
  import { Tabs } from '../../components/misc'
  import Preview from '../../components/misc/Preview.svelte'
  import { getEmptyValue, processCode } from '../../utils'
  import HSplitPane from './ComponentEditor/HSplitPane.svelte'

  import ModalHeader from './ModalHeader.svelte'
  import { showingIDE } from '../../stores/app'
  import { locale, onMobile } from '../../stores/app/misc'
  import { saveFields } from '../../stores/actions'
  import modal from '../../stores/app/modal'
  import activePage, {
    id as pageID,
    fields as pageFields,
    code as pageCode,
  } from '../../stores/app/activePage'
  import site, { fields as siteFields, content } from '../../stores/data/draft'
  import { buildStaticPage } from '../../stores/helpers'

  import GenericFields from '../../components/GenericFields.svelte'

  let localContent = cloneDeep($content)

  // TODO: all local page content
  let localPageFields = cloneDeep($pageFields).map((field) => ({
    ...field,
    value: localContent[$locale][$pageID][field.key],
  }))
  let localSiteFields = cloneDeep($siteFields).map((field) => ({
    ...field,
    value: localContent[$locale][field.key],
  }))

  $: showPageFields = localPageFields.length > 0

  $: syncLocales($content)
  function syncLocales(content) {
    // runs when adding new locale from Fields
    Object.keys(content).forEach((loc) => {
      if (!localContent[loc]) {
        localContent = {
          ...localContent,
          [loc]: localContent['en'],
        }
      }
    })
  }

  $: $locale, setupFields(), updatePagePreview()
  function setupFields() {
    localPageFields = getFieldValues(localPageFields, 'page')
    localSiteFields = getFieldValues(localSiteFields, 'site')
  }

  function getFieldValues(fields, context) {
    return fields.map((field) => ({
      ...field,
      value:
        (context === 'site'
          ? localContent[$locale][field.key]
          : localContent[$locale][$pageID][field.key]) || getEmptyValue(field),
    }))
  }

  function saveLocalContent() {
    // TODO: use _set to mutate the object instead of reassigning it on every keypress
    localContent = cloneDeep({
      ...localContent,
      [$locale]: {
        ...localContent[$locale],
        ..._chain(localSiteFields).keyBy('key').mapValues('value').value(),
        [$pageID]: {
          ...localContent[$locale][$pageID],
          ..._chain(localPageFields).keyBy('key').mapValues('value').value(),
        },
      },
    })

    // create keys within other locales if missing
    const siteEnglishVariables = _chain(localSiteFields)
      .keyBy('key')
      .mapValues('value')
      .value()
    Object.entries(localContent).forEach(([loc, content]) => {
      Object.keys(siteEnglishVariables).forEach((key) => {
        if (content[key] === undefined) {
          localContent[loc][key] = siteEnglishVariables[key]
        }
      })
    })

    updatePagePreview()
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
  ]

  // prevent showing page field tab in CMS if no page fields exist
  $: if (!showPageFields && $activeTab === 0 && !$showingIDE) $activeTab = 1

  function applyFields() {
    saveFields(localPageFields, localSiteFields, localContent)
    modal.hide()
  }

  let preview = ''
  // $: localStorage.setItem('preview', preview)
  updatePagePreview()
  async function updatePagePreview() {
    preview = await buildStaticPage({
      page: $activePage,
      site: {
        ...$site,
        content: localContent,
      },
    })
  }
</script>

<ModalHeader
  icon="fas fa-database"
  title={$showingIDE ? 'Fields' : 'Content'}
  button={{ label: `Draft`, icon: 'fas fa-check', onclick: applyFields }}
  warn={() => {
    if (
      !isEqual(localPageFields, $pageFields) ||
      !isEqual(localSiteFields, $siteFields)
    ) {
      const proceed = window.confirm(
        'Undrafted changes will be lost. Continue?'
      )
      return proceed
    } else return true
  }}
/>

<main>
  <HSplitPane
    bind:leftPaneSize={$leftPaneSize}
    bind:rightPaneSize={$rightPaneSize}
    hideRightPanel={$onMobile}
    hideLeftOverflow={true}
  >
    <div slot="left">
      <div class="editor-container">
        {#if showPageFields || $showingIDE}
          <Tabs {tabs} bind:activeTab={$activeTab} />
        {/if}
        {#if $activeTab === 0}
          <GenericFields
            showCode={$showingIDE}
            bind:fields={localPageFields}
            on:input={debounce(saveLocalContent, 200)}
          />
        {:else}
          <GenericFields
            showCode={$showingIDE}
            bind:fields={localSiteFields}
            on:input={debounce(saveLocalContent, 200)}
          />
        {/if}
      </div>
    </div>
    <div slot="right" class="preview">
      <div class="preview-container">
        <Preview {preview} ratio={1} />
      </div>
    </div>
  </HSplitPane>
</main>

<style lang="postcss">
  * {
    --Preview-iframe-width: 100%;
  }
  main {
    padding: 0 0.5rem;
    background: var(--primo-color-black);
    height: 100%;
    display: flex;

    .editor-container {
      display: flex;
      flex-direction: column;
      max-height: calc(100vh - 100px); /* stopgap for scrolling issue */
      /* overflow-y: scroll;  */
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

  .preview {
    position: absolute;
    inset: 0;
    /* background: var(--primo-color-white); */
    display: block;
    width: 100%;
    overflow: hidden;
    transition: var(--transition-colors);
    min-height: 10rem;

    .preview-container {
      all: unset;
      height: 100%;
      z-index: -1; /* needed for link */
    }
  }
</style>
