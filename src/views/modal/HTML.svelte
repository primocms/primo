<script>
  import _ from 'lodash'
  import {Tabs} from '../../components/misc'
  import {CodeMirror} from '../../components'
  import { parseHandlebars, convertFieldsToData } from '../../utils'
  import ModalHeader from './ModalHeader.svelte'

  import modal from '../../stores/app/modal'
  import {getAllFields} from '../../stores/helpers'
  import {wrapper as pageHTML} from '../../stores/app/activePage'
  import {wrapper as siteHTML} from '../../stores/data/draft'

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
    <span class="mb-1 inline-block font-semibold text-gray-200">{'<head>'}</span> 
    <CodeMirror 
      bind:value={activeHTML.head.raw} 
      on:change={saveFinalHTML}
      style="height:10rem" 
      mode="html"
    />

    <span class="mb-1 mt-4 inline-block font-semibold text-gray-200">{'Before </body>'}</span> 
    <CodeMirror 
      bind:value={activeHTML.below.raw} 
      on:change={saveFinalHTML}
      style="height:15rem" 
      mode="html"
    />
  </div>
</div>
