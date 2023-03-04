<script context="module">
  import { writable, get } from 'svelte/store'

  const leftPaneSize = writable(get(onMobile) ? '100%' : '50%')
  const rightPaneSize = writable('50%')
  const topPaneSize = writable(get(onMobile) ? '100%' : '50%')
  const bottomPaneSize = writable('50%')
  const orientation = writable('horizontal')
  const activeTab = writable(0)
</script>

<script lang="ts">
  import { _ as C } from 'svelte-i18n'
  import { cloneDeep, find, isEqual, chain as _chain } from 'lodash-es'
  import HSplitPane from './HSplitPane.svelte'
  import { getPlaceholderValue, getEmptyValue } from '../../../utils'
  import ModalHeader from '../ModalHeader.svelte'
  import { Tabs, Card } from '../../../components/misc'
  import FullCodeEditor from './FullCodeEditor.svelte'
  import { CodePreview } from '../../../components/misc'
  import GenericFields from '../../../components/GenericFields.svelte'
  import { autoRefresh } from '../../../components/misc/CodePreview.svelte'

  import { processCode, processCSS, wrapInStyleTags } from '../../../utils'
  import { locale, onMobile } from '../../../stores/app/misc'

  import { content, code as siteCode } from '../../../stores/data/draft'
  import {
    id as pageID,
    code as pageCode,
  } from '../../../stores/app/activePage'
  import { showingIDE } from '../../../stores/app'
  import { Component } from '../../../const'
  import type {
    Component as ComponentType,
    Symbol as SymbolType,
    Field as FieldType,
  } from '../../../const'
  import {
    getPageData,
    getSymbol,
    getComponentData,
  } from '../../../stores/helpers'
  import { tick } from 'svelte'

  export let component: ComponentType | SymbolType = Component()
  export let header = {
    label: 'Create Component',
    icon: 'fas fa-code',
    button: {
      icon: 'fas fa-plus',
      label: 'Add to page',
      onclick: (component) => {
        console.warn('Component not going anywhere', component)
      },
    },
  }

  const placeholders = new Map()
  function getCachedPlaceholder(field) {
    const key = JSON.stringify(field)
    if (placeholders.has(key)) {
      return placeholders.get(key)
    } else {
      const val = getPlaceholderValue(field)
      placeholders.set(key, val)
      return val
    }
  }

  let local_component: SymbolType = cloneDeep(component) // local copy of component to modify & save
  let local_content =
    component.type === 'symbol'
      ? component.content
      : getComponentContent($content) // local copy of component content to modify & save

  console.log({ local_content, component })
  // component data w/ page/site data included (for compilation)
  $: data = {
    ...getPageData({ loc: $locale }),
    ...getSymbolPlaceholders(fields), // empty?
    ...local_content[$locale],
  }

  function getSymbolPlaceholders(fields) {
    return _chain(fields)
      .keyBy('key')
      .mapValues((f) => {
        return f.default || getCachedPlaceholder(f)
      })
      .value()
  }

  // parse component-specific content out of site content tree (keeping separate locales)
  function getComponentContent(siteContent): object {
    const symbol =
      component.type !== 'symbol' ? getSymbol(component.symbolID) : component
    console.log({ component, symbol })
    return _chain(Object.entries(siteContent))
      .map(([locale]) => {
        return {
          locale,
          content: getComponentData({
            loc: locale,
            component: local_component,
          }),
        }
      })
      .keyBy('locale')
      .mapValues('content')
      .value()
  }

  $: setupComponent($locale) // swap content out of on-screen fields
  function setupComponent(loc) {
    fields = getFieldValues(fields, loc)
  }

  // hydrate fields with content (placeholder if passed component is a Symbol)
  function getFieldValues(fields: Array<FieldType>, loc: string): Array<any> {
    return fields.map((field) => {
      if (component.type === 'symbol') {
        const field_value = component.content[loc]?.[field.key]
        const value =
          field_value !== undefined ? field_value : getCachedPlaceholder(field)
        return {
          ...field,
          value,
        }
      } else {
        const field_value = local_content[loc]?.[field.key]
        const value =
          field_value !== undefined ? field_value : getCachedPlaceholder(field)
        return {
          ...field,
          value,
        }
      }
    })
  }

  // Ensure all content keys match field keys
  $: component.type !== 'symbol' && syncFieldKeys(fields)
  $: component.type !== 'symbol' && syncLocales($content)

  function syncLocales(content) {
    // runs when adding new locale from ComponentEditor
    Object.keys(content).forEach((loc) => {
      if (!local_content[loc]) {
        local_content = {
          ...local_content,
          [loc]: local_content['en'],
        }
      }
    })
  }

  function syncFieldKeys(fields) {
    removeNonexistantKeys() // delete keys from content that do not appear in fields
    addMissingKeys() // add keys that do appear in fields

    function addMissingKeys() {
      let updatedContent = cloneDeep(local_content)
      fields.forEach((field) => {
        if (local_content[$locale][field.key] === undefined) {
          Object.keys(local_content).forEach((loc) => {
            updatedContent[loc][field.key] = getEmptyValue(field)
          })
        }
      })
      local_content = updatedContent
    }

    // Remove content when field deleted
    function removeNonexistantKeys() {
      let updatedContent = cloneDeep(local_content)
      Object.keys(local_content[$locale]).forEach((key) => {
        if (!find(fields, ['key', key])) {
          Object.keys(local_content).forEach((loc) => {
            delete updatedContent[loc][key]
          })
        }
      })
      local_content = updatedContent
      refreshPreview()
    }
  }

  function saveLocalContent(): void {
    // TODO
    // save field value to all locales where block is used
    // when block gets added to page, add static value as content to locale

    console.log({ fields })
    local_content = {
      ...local_content,
      [$locale]: {
        ...local_content[$locale],
        ..._chain(fields).keyBy('key').mapValues('value').value(),
      },
    }
    console.log({ local_content })
  }

  function saveLocalValue(
    property: 'html' | 'css' | 'js' | 'fields',
    value: any
  ): void {
    if (property === 'fields') {
      local_component.fields = value
      fields = getFieldValues(value, $locale)
    } else {
      local_component.code[property] = value
    }
  }

  let loading = false

  // raw code bound to code editor
  let rawHTML = local_component.code.html
  let rawCSS = local_component.code.css
  let rawJS = local_component.code.js

  // changing codes triggers compilation
  $: $autoRefresh &&
    compileComponentCode({
      html: rawHTML,
      css: rawCSS,
      js: rawJS,
    })

  // on-screen fields
  let fields = local_component.fields

  console.log({ fields })

  let componentApp // holds compiled component
  let compilationError // holds compilation error

  // ensure placeholder values always conform to form
  // TODO: do for remaining fields
  $: fields = fields.map((field) => {
    if (
      component.type === 'symbol' &&
      field.type === 'link' &&
      !field.value?.url
    )
      return {
        ...field,
        value: getCachedPlaceholder(field),
      }
    else return field
  })

  let disableSave = false
  async function compileComponentCode({ html, css, js }) {
    disableSave = true
    loading = true

    await compile()
    disableSave = compilationError
    await setTimeout(() => {
      loading = false
    }, 200)

    async function compile() {
      const parentCSS = await processCSS($siteCode.css + $pageCode.css)
      const res = await processCode({
        component: {
          html: `
      <svelte:head>
        ${$siteCode.html.head}
        ${$pageCode.html.head}
        ${wrapInStyleTags(parentCSS, 'parent-styles')}
      </svelte:head>
      ${html}
      ${$pageCode.html.below}
      ${$siteCode.html.below}
      `,
          css,
          js,
          data,
        },
        buildStatic: false,
      })
      compilationError = res.error
      componentApp = res.js
      saveLocalValue('html', html)
      saveLocalValue('css', css)
      saveLocalValue('js', js)
    }
  }

  const tabs = [
    {
      id: 'code',
      label: $C('Code'),
      icon: 'code',
    },
    {
      id: 'fields',
      label: $C('Fields'),
      icon: 'database',
    },
  ]

  let previewUpToDate = false
  $: rawHTML, rawCSS, rawJS, (previewUpToDate = false) // reset when code changes

  async function refreshPreview() {
    await compileComponentCode({
      html: rawHTML,
      css: rawCSS,
      js: rawJS,
    })
    previewUpToDate = true
  }

  async function saveComponent() {
    if (!previewUpToDate) {
      await refreshPreview()
    }

    const ExtractedComponent = (component) => ({
      ...component,
      content: local_content,
      fields: fields.map((field) => {
        delete field.value
        return field
      }),
    })

    if (!disableSave) {
      const component = ExtractedComponent(local_component)
      console.log('final', component)
      header.button.onclick(component)
    }
  }
</script>

<ModalHeader
  {...header}
  warn={() => {
    if (!isEqual(local_component, component)) {
      const proceed = window.confirm(
        'Undrafted changes will be lost. Continue?'
      )
      return proceed
    } else return true
  }}
  button={{ ...header.button, onclick: saveComponent, disabled: disableSave }}
/>

<main class:showing-ide={$showingIDE} class:showing-cms={!$showingIDE}>
  <HSplitPane
    orientation={$orientation}
    bind:leftPaneSize={$leftPaneSize}
    bind:rightPaneSize={$rightPaneSize}
    bind:topPaneSize={$topPaneSize}
    bind:bottomPaneSize={$bottomPaneSize}
    hideRightPanel={$onMobile}
    hideLeftOverflow={$showingIDE && $activeTab === 0}
  >
    <div slot="left" lang={$locale}>
      {#if $showingIDE}
        <Tabs {tabs} bind:activeTab={$activeTab} />
        {#if $activeTab === 0}
          <FullCodeEditor
            bind:html={rawHTML}
            bind:css={rawCSS}
            bind:js={rawJS}
            {data}
            on:save={saveComponent}
            on:refresh={refreshPreview}
          />
        {:else if $activeTab === 1}
          <GenericFields
            bind:fields
            on:input={() => {
              refreshPreview()
              saveLocalContent()
            }}
            on:delete={async () => {
              await tick() // wait for fields to update
              saveLocalContent()
              refreshPreview()
            }}
            showCode={true}
          />
        {/if}
      {:else}
        <GenericFields
          bind:fields
          on:save={saveComponent}
          on:input={() => {
            fields = fields.filter(Boolean) // to trigger setting `data`
            saveLocalContent()
          }}
          showCode={false}
        />
      {/if}
    </div>
    <div slot="right">
      <CodePreview
        bind:orientation={$orientation}
        view="small"
        {loading}
        {componentApp}
        {data}
        error={compilationError}
      />
    </div>
  </HSplitPane>
</main>

<style lang="postcss">
  main {
    display: flex; /* to help w/ positioning child items in code view */
    background: var(--primo-color-black);
    color: var(--color-gray-2);
    padding: 0 0.5rem;
    flex: 1;
    overflow: hidden;

    --PrimaryButton-bg: var(--color-gray-8);
    --PrimaryButton-bg-hover: var(--color-gray-9);
  }

  [slot='right'] {
    width: 100%;
  }

  :global(.showing-cms [slot='left']) {
    height: 100% !important;
  }

  :global(.showing-cms .wrapper.vertical) {
    height: 100% !important;
  }

  [slot='left'] {
    /* height: calc(100% - 45px); */
    height: 100%;

    display: flex;
    flex-direction: column;
  }
</style>
