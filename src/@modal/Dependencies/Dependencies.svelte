<script>
  import { slide, fade } from 'svelte/transition'
  import _ from 'lodash'
  import { createEventDispatcher, onMount } from 'svelte'
  const dispatch = createEventDispatcher()
  import {Tabs} from '../../@components/misc'
  import {SaveButton} from '../../@components/buttons'

  import {modal} from '../../@stores/app'
  import {pageData} from '../../@stores/data'

  import HeadEmbeds from './_HeadEmbeds.svelte'
  import Libraries from './_Libraries.svelte'

  let localDependencies = _.cloneDeep($pageData.dependencies)

  const tabs = [
    {
      id: 'head',
      label: 'Head Embeds',
      component: HeadEmbeds
    },
    {
      id: 'js',
      label: 'Libraries',
      component: Libraries
    },
  ]

  let selectedTab = tabs[0]

  let disableSave = false

</script>

<div class="flex flex-col h-full">
  <!-- <Tabs {tabs} bind:activeTab={selectedTab} variants="mb-4" /> -->
  <Libraries bind:libraries={localDependencies.libraries} />

  <!-- <div class="flex-1">
    {#if selectedTab === tabs[0]}
      <HeadEmbeds bind:headEmbed={localDependencies.headEmbed} />
    {:else if selectedTab === tabs[1]}
      <Libraries bind:libraries={localDependencies.libraries} />
    {/if}
  </div> -->
  <div class="flex justify-end py-2">
    <SaveButton 
      disabled={disableSave}
      on:click={() => {
        pageData.save('dependencies', localDependencies)
        modal.hide()
      }}>Save Dependencies</SaveButton>
  </div>
</div>
