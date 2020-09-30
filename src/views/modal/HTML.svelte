<script lang="ts">
  import { slide, fade } from 'svelte/transition'
  import _ from 'lodash'
  import { createEventDispatcher, onMount } from 'svelte'
  const dispatch = createEventDispatcher()
  import {Tabs} from '../../components/misc'
  import {SaveButton} from '../../components/buttons'
  import {CodeMirror} from '../../components'
  import { parseHandlebars, convertFieldsToData } from '../../utils'
  import ModalHeader from './ModalHeader.svelte'

  import modal from '../../stores/app/modal'
  import {wrapper as pageHTML} from '../../stores/app/activePage'
  // import pageHTML from '../../stores/data/page/wrapper'
  // import siteHTML from '../../stores/data/site/wrapper'
  // import pageFields from '../../stores/data/page/fields'
  // import siteFields from '../../stores/data/site/fields'
  import {fields as pageFields} from '../../stores/app/activePage'
  import {wrapper as siteHTML, fields as siteFields} from '../../stores/data/draft'

  let activeHTML = $pageHTML
  $: activeHTML = activeTab.id === 'page' ? $pageHTML : $siteHTML

  const tabs = [
    {
      id: 'page',
      label: 'Page',
      icon: 'square'
    },
    {
      id: 'site',
      label: 'Site',
      icon: 'th'
    }
  ]

  let activeTab = tabs[0]

  async function updateHtmlWithFieldData(rawHTML) {
    const allFields = getAllFields()
    const data = await convertFieldsToData(allFields, 'all')
    const finalHTML = await parseHandlebars(rawHTML, data)
    return finalHTML

    function getAllFields() {
      const allFields = _.unionBy($pageFields, $siteFields, "key");
      return allFields
    }
  }

  async function saveFinalHTML() {
    if (activeTab['id'] === 'page') {
      $pageHTML.head.raw = activeHTML.head.raw
      $pageHTML.head.final = await updateHtmlWithFieldData(activeHTML.head.raw)
      $pageHTML.below.raw = activeHTML.below.raw
      $pageHTML.below.final = await updateHtmlWithFieldData(activeHTML.below.raw)
    } else {
      $siteHTML.head.raw = activeHTML.head.raw
      $siteHTML.head.final = await updateHtmlWithFieldData(activeHTML.head.raw)
      $siteHTML.below.raw = activeHTML.below.raw
      $siteHTML.below.final = await updateHtmlWithFieldData(activeHTML.below.raw)
    }
  }



</script>

<ModalHeader 
  icon="fab fa-html5"
  title="HTML"
  button={{
    label: `Draft`,
    icon: 'fas fa-check',
    onclick: () => modal.hide()
  }}
  variants="mb-4"
/>

<div class="flex flex-col">
  <Tabs {tabs} bind:activeTab variants="mb-4" />
  <div class="flex-1">
    <span class="mb-1 inline-block font-semibold text-gray-700">{'<head>'}</span> 
    <CodeMirror 
      bind:value={activeHTML.head.raw} 
      on:change={saveFinalHTML}
      style="height:10rem" 
      mode={{
        name: 'handlebars',
        base: 'text/html'
      }}
    />

    <span class="mb-1 mt-4 inline-block font-semibold text-gray-700">{'Before </body>'}</span> 
    <CodeMirror 
      bind:value={activeHTML.below.raw} 
      on:change={saveFinalHTML}
      style="height:15rem" 
      mode={{
        name: 'handlebars',
        base: 'text/html'
      }}
    />
  </div>
</div>
