<script>
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
  import site from '../../stores/data/site'
  import pageData from '../../stores/data/pageData'

  let pageWrapper = _.cloneDeep($pageData.wrapper)
  let siteWrapper = _.cloneDeep($site.wrapper)

  let wrapper = pageWrapper

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

  let showingPage = true
  $: showingPage = activeTab === tabs[0]

  $: if (showingPage) {
    wrapper = pageWrapper
  } else {
    wrapper = siteWrapper
  }

  function getAllFields() {
    const siteFields = _.cloneDeep($site.fields)
    const pageFields = _.cloneDeep($pageData.fields)
    const allFields = _.unionBy(pageFields, siteFields, "key");
    return allFields
  }

  async function updateHtmlWithFieldData(rawHTML) {
    const allFields = getAllFields()
    const data = await convertFieldsToData(allFields, 'all')
    const finalHTML = await parseHandlebars(rawHTML, data)
    return finalHTML
  }

</script>

<ModalHeader 
  icon="fab fa-html5"
  title="HTML"
  button={{
    label: `Save`,
    icon: 'fas fa-save',
    onclick: () => {
      site.saveCurrentPage({ wrapper: pageWrapper })
      site.save({ wrapper: siteWrapper })
      pageData.save('wrapper', pageWrapper)
      modal.hide()
    }
  }}
  variants="mb-4"
/>

<div class="flex flex-col">
  <Tabs {tabs} bind:activeTab variants="mb-4" />
  <div class="flex-1">
    <span class="mb-1 inline-block font-semibold text-gray-700">{'<head>'}</span> 
    <CodeMirror 
      bind:value={wrapper.head.raw} 
      on:change={_.debounce( async() => { 
        wrapper.head.final = await updateHtmlWithFieldData(wrapper.head.raw)
      }, 1000 )}
      style="height:10rem" 
      mode={{
        name: 'handlebars',
        base: 'text/html'
      }}
    />

    <span class="mb-1 mt-4 inline-block font-semibold text-gray-700">{'Before </body>'}</span> 
    <CodeMirror 
      bind:value={wrapper.below.raw} 
      on:change={_.debounce( async() => { 
        wrapper.below.final = await updateHtmlWithFieldData(wrapper.below.raw)
      }, 1000 )}
      style="height:15rem" 
      mode={{
        name: 'handlebars',
        base: 'text/html'
      }}
    />
  </div>
  <!-- <div class="flex justify-end py-2">
    <SaveButton 
      on:click={() => {
        site.saveCurrentPage({ wrapper: pageWrapper })
        site.save({ wrapper: siteWrapper })
        pageData.save('wrapper', pageWrapper)
        modal.hide()
      }}>Save HTML</SaveButton>
  </div> -->
</div>
