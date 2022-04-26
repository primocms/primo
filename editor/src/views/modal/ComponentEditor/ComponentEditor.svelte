<script lang="ts">
  import {_ as C} from 'svelte-i18n'
  import { cloneDeep, find, isEqual, chain as _chain, set as _set, get as _get, differenceWith as _differenceWith} from 'lodash-es';
  import HSplitPane from './HSplitPane.svelte';
  import { getPlaceholderValue, getEmptyValue } from '../../../utils';
  import ModalHeader from '../ModalHeader.svelte';
  import { Tabs, Card } from '../../../components/misc';
  import FullCodeEditor from './FullCodeEditor.svelte';
  import { CodePreview } from '../../../components/misc';
  import GenericFields from '../../../components/GenericFields.svelte'

  import {
    processCode,
    processCSS,
    wrapInStyleTags,
  } from '../../../utils';
  import { locale, onMobile } from '../../../stores/app/misc';

  import { content, code as siteCode } from '../../../stores/data/draft';
  import {
    id as pageID,
    code as pageCode
  } from '../../../stores/app/activePage';
  import { showingIDE } from '../../../stores/app';
  import { Component } from '../../../const';
  import type { Component as ComponentType, Symbol as SymbolType, Field as FieldType } from '../../../const';
  import { getPageData } from '../../../stores/helpers';

  export let component:ComponentType|SymbolType = Component();
  export let header = {
    label: 'Create Component',
    icon: 'fas fa-code',
    button: {
      icon: 'fas fa-plus',
      label: 'Add to page',
      onclick: (component) => {
        console.warn('Component not going anywhere', component);
      },
    },
  };

  let placeholders = new Map()
  function getCachedPlaceholder(field) {
    if (placeholders.has(field.id)) {
      return placeholders.get(field.id)
    } else {
      const val = getPlaceholderValue(field)
      placeholders.set(field.id, val)
      return val
    }
  }

  let localComponent:SymbolType = cloneDeep(component) // local copy of component to modify & save 
  let localContent = component.type === 'symbol' ? {} : getComponentContent($content) // local copy of component content to modify & save

  // component data w/ page/site data included (for compilation)
  $: data = {
    ...getPageData({ loc: $locale }),
    ...getSymbolPlaceholders(fields),
    ...(localContent[$locale])
  }

  function getSymbolPlaceholders(fields) {
    console.log(cloneDeep(fields))
    return _chain(fields).keyBy('key').mapValues(f => f.default || getCachedPlaceholder(f)).value()
  }

  // parse component-specific content out of site content tree (keeping separate locales)
  function getComponentContent(siteContent): object {
    return _chain(Object.entries(siteContent)) 
      .map(([locale]) => ({
        locale,
        content: $content[locale][$pageID][localComponent.id] || getSymbolPlaceholders(localComponent.fields)
      }))
      .keyBy('locale')
      .mapValues('content')
      .value()
  }
  
  $: setupComponent($locale) // swap content out of on-screen fields
  function setupComponent(loc) {
    fields = getFieldValues(fields, loc)
  }

  // hydrate fields with content (placeholder if passed component is a Symbol)
  function getFieldValues(fields:Array<FieldType>, loc:string): Array<any> {
    return fields.map(field => ({
      ...field,
      value: component.type === 'symbol' ? getCachedPlaceholder(field) : (localContent[loc]?.[field.key] !== undefined ? localContent[loc]?.[field.key] : getCachedPlaceholder(field))
    }))
  }


  // Ensure all content keys match field keys
  $: component.type !== 'symbol' && syncFieldKeys(fields) 
  $: component.type !== 'symbol' && syncLocales($content)

  function syncLocales(content) {
    // runs when adding new locale from ComponentEditor
    Object.keys(content).forEach((loc) => {
      if (!localContent[loc]) {
        localContent = {
          ...localContent,
          [loc]: localContent['en']
        }
      }
    })
  }

  function syncFieldKeys(fields) {
    removeNonexistantKeys() // delete keys from content that do not appear in fields
    addMissingKeys() // add keys that do appear in fields

    function addMissingKeys() {
      let updatedContent = cloneDeep(localContent)
      fields.forEach(field => {
        if (localContent[$locale][field.key] === undefined) {
          console.log('DOES NOT EXIST, adding', field.key)
          Object.keys(localContent).forEach(loc => {
            updatedContent[loc][field.key] = getEmptyValue(field)
          })
        }
      })
      localContent = updatedContent
    }

    // Remove content when field deleted
    function removeNonexistantKeys() {
      let updatedContent = cloneDeep(localContent)
      Object.keys(localContent[$locale]).forEach((key) => {
        if (!find(fields, ['key', key])) {
          console.log('Value does not exist, deleting', key)
          Object.keys(localContent).forEach(loc => {
            delete updatedContent[loc][key]
          })
        } 
      })
      localContent = updatedContent
      refreshPreview()
    }
  }


  function saveLocalContent(): void {
    localContent = {
      ...localContent,
      [$locale]: {
        ...localContent[$locale],
        ..._chain(fields).keyBy('key').mapValues('value').value()
      }
    }
  }

  function saveLocalValue(property:'html'|'css'|'js'|'fields', value:any): void {
    if (property === 'fields') {
      localComponent.fields = value
      fields = getFieldValues(value, $locale)
    } else {
      localComponent.code[property] = value
    }
  }

  let loading = false;

  // raw code bound to code editor
  let rawHTML = localComponent.code.html;
  let rawCSS = localComponent.code.css;
  let rawJS = localComponent.code.js;

  // changing codes triggers compilation
  $: compileComponentCode({
    html: rawHTML,
    css: rawCSS,
    js: rawJS
  });

  // on-screen fields
  let fields = localComponent.fields;

  let componentApp; // holds compiled component
  let compilationError; // holds compilation error


  // ensure placeholder values always conform to form
  // TODO: do for remaining fields
  $: fields = fields.map(field => {
    if (component.type === 'symbol' && field.type === 'link' && !field.value?.url) return {
      ...field,
      value: getCachedPlaceholder(field) 
    }
    else return field 
  })



  // hover preview node, highlight line in code editor

  // hover tag in code editor, highlight preview node


  let disableSave = false;
  async function compileComponentCode({ html, css, js }) {
    disableSave = true;

    // automatically create fields for keys without fields
    // TODO: prevent creating multiple fields for the same key (e.g. when typing {} first then {heading})
    // account for keys passed down from page/site fields
    // allow user to delete fields, even if the key is still used in the html (i.e. don't recreate them)

    // const keys = html.match(/(?<=\{\s*).*?(?=\s*\})/gs) || []// extract keys 
    // const notInFields = keys.map(s => s.replace(/\s/g, '')).filter(s => !find(fields, ['key', s]))
    // notInFields.forEach(key => {
    //   addNewField({ 
    //     key,
    //     label: capitalize(key)
    //   })
    // })

    await compile();
    disableSave = false;

    async function compile() {
      const parentCSS = await processCSS($siteCode.css + $pageCode.css)
      const res = await processCode({
        code: {
          html: `${html}
      <svelte:head>
        ${$pageCode.html.head}
        ${$siteCode.html.head}
        ${wrapInStyleTags(parentCSS)}
      </svelte:head>
      ${$pageCode.html.below}
      ${$siteCode.html.below}
      `,
          css,
          js,
        },
        data,
        buildStatic: false,
      });
      compilationError = res.error;
      componentApp = res.js;
      saveLocalValue('html', html);
      saveLocalValue('css', css);
      saveLocalValue('js', js);
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
  ];

  let activeTab = tabs[0];

  let editorWidth = localStorage.getItem('editorWidth') || '66%';
  let previewWidth = localStorage.getItem('previewWidth') || '33%';

  function refreshPreview() {
    compileComponentCode({
      html: rawHTML,
      css: rawCSS,
      js: rawJS
    })
  }

  function saveComponent() {

    const ExtractedComponent = (component) => ({
      ...component,
      content: localContent,
      fields: fields.map(field => {
        delete field.value
        return field
      })
    })

    if (!disableSave) {
      const component = ExtractedComponent(localComponent)
      header.button.onclick(component);
    }
  }

  $: console.log(cloneDeep(fields))

  let highlightedTag
  $: console.log(highlightedTag)


  $: highlightTag(highlightedTag)
  async function highlightTag(toHighlight) {

  }
</script>

<ModalHeader
  {...header}
  warn={() => {
    if (!isEqual(localComponent, component)) {
      const proceed = window.confirm('Undrafted changes will be lost. Continue?');
      return proceed;
    } else return true;
  }}
  button={{ ...header.button, onclick: saveComponent, disabled: disableSave }}>
</ModalHeader>

<main>
  <HSplitPane
    leftPaneSize={$onMobile ? '100%' : editorWidth}
    rightPaneSize={$onMobile ? '0' : previewWidth}
    hideRightPanel={$onMobile}
    hideLeftOverflow={$showingIDE && activeTab === tabs[0]}
    on:resize={({ detail }) => {
      const { left, right } = detail;
      localStorage.setItem('editorWidth', left);
      localStorage.setItem('previewWidth', right);
    }}>
    <div slot="left" lang={$locale}>
      {#if $showingIDE}
        <Tabs {tabs} bind:activeTab />
        {#if activeTab === tabs[0]}
          <FullCodeEditor
            variants="flex-1"
            bind:html={rawHTML}
            bind:css={rawCSS}
            bind:js={rawJS}
            on:save={saveComponent} 
            bind:highlightedTag
          />
        {:else if activeTab === tabs[1]}
          <GenericFields bind:fields on:input={refreshPreview} />
        {/if}
      {:else}
        <GenericFields bind:fields on:input={() => {
          fields = fields.filter(Boolean) // to trigger setting `data`
          saveLocalContent()
        }} />
      {/if}
    </div>
    <div slot="right">
      <CodePreview
        view="small"
        bind:highlightedTag
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
    padding: 0.5rem;
    padding-top: 0;
    flex: 1;
    overflow: hidden;

    --PrimaryButton-bg: var(--color-gray-8);
    --PrimaryButton-bg-hover: var(--color-gray-9);
  }

  [slot="right"] {
    width: 100%;
  }

</style>
