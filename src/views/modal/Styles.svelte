<script>
  import {createEventDispatcher, onMount, onDestroy} from 'svelte'
  import {writable} from 'svelte/store'
  const dispatch = createEventDispatcher()
  import _ from 'lodash'
  import {CodeMirror} from '../../components'
  import {Tabs} from '../../components/misc'
  import {CodePreview} from '../../components/misc'
  import {SaveButton} from '../../components/buttons'
  import { wrapInStyleTags,buildPagePreview, createDebouncer } from '../../utils'
  import ModalHeader from './ModalHeader.svelte'
  import {processors} from '../../component'

  const quickDebounce = createDebouncer(500);

  import tailwind, {getCombinedTailwindConfig} from '../../stores/data/tailwind'
  import {content,id} from '../../stores/app/activePage'
  import modal from '../../stores/app/modal'

  import {styles as pageStyles} from '../../stores/app/activePage'
  import {styles as siteStyles, pages} from '../../stores/data/draft'
import { getTailwindConfig } from '../../stores/helpers';

  let pageHTML
  let siteHTML 

  function buildPreview(twCSS, siteCSS, pageCSS, content) {
    return {
      html: wrapInStyleTags(siteCSS)
        + wrapInStyleTags(pageCSS) 
        + buildPagePreview(content, getTailwindConfig())
    }
  }

  $: currentPage = buildPreview($tailwind, $siteStyles.final, $pageStyles.final, $content) 
  let allPages = []
  $: quickDebounce[buildSitePreview, $tailwind + $siteStyles.final] 
  function buildSitePreview(parentStyles) {
    console.log('site preview')
    allPages = $pages.map(page => buildPreview(parentStyles + page.styles.final, page.content))
  }

  let loading = false

  let rawStyles = $pageStyles.raw;
  let finalStyles = $pageStyles.final; 
  let moduleTailwindConfig = $pageStyles.tailwind;

  $: tailwindConfig = moduleTailwindConfig.replace('export default ','')

  let tailwindConfigChanged = false

  const cachedTailwindConfig = moduleTailwindConfig.replace('export default ','')

  $: cssSize = (new Blob([finalStyles]).size / 1000).toFixed(1)

  const primaryTabs = [
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

  let primaryTab = primaryTabs[0]

  let showingPage = true
  $: showingPage = primaryTab === primaryTabs[0]

  const secondaryTabs = [
    {
      id: 'styles',
      label: 'CSS'
    },
    {
      id: 'tw',
      label: 'Tailwind Config'
    },
  ]

  let secondaryTab = secondaryTabs[0]

  let view = 'large'

  $: quickDebounce([compileStyles, primaryTab.id === 'page' ? $pageStyles : $siteStyles]); 
  async function compileStyles(styles) {
    loading = true
    const result = await processors.css(
      styles.raw, 
      {
        tailwindConfig: styles.tailwind, 
        includeBase: false,
        includeTailwind: false,
        purge: false,
        html: ''
      }
    );
    loading = false
    if (!result.error) {
      styles.final = result
      if (tailwindConfigChanged) {
        const combinedTailwindConfig = getCombinedTailwindConfig($pageStyles.tailwind, $siteStyles.tailwind)
        tailwind.swapInConfig(combinedTailwindConfig, () => {
          tailwindConfigChanged = false
        })
      }
    } 
  }

</script>

<ModalHeader 
  icon="fab fa-css3"
  title="CSS"
  button={{
    label: `Draft`,
    icon: 'fas fa-check',
    onclick: () => {
      // tailwind.saveSwappedInConfig() TODO
      modal.hide()
    },
    loading
  }}
  variants="mb-4"
/>

<div class="h-full flex flex-col">
  <div class="flex flex-row flex-1">
    <div class="w-1/2 flex flex-col">
        <Tabs tabs={primaryTabs} bind:activeTab={primaryTab} variants="mb-2" />
        <Tabs tabs={secondaryTabs} bind:activeTab={secondaryTab} variants="secondary" />
        {#if primaryTab.id === 'page' && secondaryTab.id === 'styles'}
          <CodeMirror 
            autofocus
            bind:value={$pageStyles.raw} 
            mode="css" 
            docs="https://adam-marsden.co.uk/css-cheat-sheet"
          />
        {:else if primaryTab.id === 'page' && secondaryTab.id === 'tw'}
          <CodeMirror 
            autofocus
            prefix="module.exports = "
            bind:value={$pageStyles.tailwind} 
            on:change={() => tailwindConfigChanged = true}
            mode="javascript" 
            docs="https://tailwindcss.com/docs/configuration"
          />
        {:else if primaryTab.id === 'site' && secondaryTab.id === 'styles'}
          <CodeMirror 
            autofocus
            bind:value={$siteStyles.raw} 
            mode="css" 
            docs="https://adam-marsden.co.uk/css-cheat-sheet"
          />
        {:else if primaryTab.id === 'site' && secondaryTab.id === 'tw'}
          <CodeMirror 
            autofocus
            prefix="module.exports = "
            bind:value={$siteStyles.tailwind} 
            on:change={() => tailwindConfigChanged = true}
            mode="javascript" 
            docs="https://tailwindcss.com/docs/configuration"
          />
        {/if} 
    </div>
    <div class="w-1/2">
      {#if primaryTab.id === 'page'}
        <CodePreview 
          bind:view
          html={currentPage.html}
        />
      {:else}
        <CodePreview 
          bind:view
          multiple={true}
          pages={allPages}
        />
      {/if}

    </div>
  </div>
</div>