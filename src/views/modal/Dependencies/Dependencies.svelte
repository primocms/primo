<script>
  import { slide, fade } from 'svelte/transition'
  import _ from 'lodash'
  import { createEventDispatcher, onMount } from 'svelte'
  const dispatch = createEventDispatcher()
  import {Tabs} from '../../../components/misc'
  import {SaveButton} from '../../../components/buttons'

  import modal from '../../../stores/app/modal'
  import site from '../../../stores/data/site'
  import pageData from '../../../stores/data/pageData'

  import ModalHeader from '../ModalHeader.svelte'
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

<ModalHeader 
  icon="fas fa-cube"
  title="Page Dependencies"
  button={{
    label: `Save`,
    icon: 'fas fa-save',
    onclick: () => {
      site.saveCurrentPage({ dependencies: localDependencies })
      modal.hide()
    }
  }}
  variants="mb-4"
/>

<div class="flex flex-col h-full">
  <Libraries bind:libraries={localDependencies.libraries} />
</div>
