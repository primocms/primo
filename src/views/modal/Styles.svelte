<script>
  import {createEventDispatcher, onMount, onDestroy} from 'svelte'
  import {writable} from 'svelte/store'
  const dispatch = createEventDispatcher()
  import _ from 'lodash'
  import {CodeMirror} from '../../components'
  import {Tabs} from '../../components/misc'
  import {CodePreview} from '../../components/misc'
  import {SaveButton} from '../../components/buttons'
  import { processStyles, wrapInStyleTags,buildPagePreview } from '../../utils'
  import ModalHeader from './ModalHeader.svelte'

  import tailwind, {getCombinedTailwindConfig} from '../../stores/data/tailwind'
  import {content,id} from '../../stores/app/activePage'
  import modal from '../../stores/app/modal'

  import {styles as pageStyles} from '../../stores/app/activePage'
  import {styles as siteStyles, pages} from '../../stores/data/draft'

  let styles = $pageStyles
  $: styles = primaryTab.id === 'page' ? $pageStyles : $siteStyles

  let pageHTML
  let siteHTML 

  function buildPreview(siteCSS, pageCSS, content) {
    return {
      html: wrapInStyleTags(siteCSS)
        + wrapInStyleTags(pageCSS) 
        + buildPagePreview(content)
    }
  }

  $: currentPage = buildPreview($siteStyles.final, $pageStyles.final, $content) 
  $: allPages = $pages.map(page => page.id === $id ? currentPage : buildPreview($siteStyles.final, page.styles.final, page.content))

  let loading = false

  async function compileStyles(rawStyles, tailwindConfig) {
    loading = true
    const result = await processStyles(
      rawStyles, 
      '',
      {
        tailwindConfig, 
        includeBase: false,
        includeTailwind: false,
        purge: false
      }
    );
    if (!result.error) {
      // finalStyles = result
      if (!gettingTailwind) {
        loading = false
      } 
      return result
    } 
  }

  let rawStyles = $pageStyles.raw;
  let finalStyles = $pageStyles.final; 
  let moduleTailwindConfig = $pageStyles.tailwind;

  $: tailwindConfig = moduleTailwindConfig.replace('export default ','')
  $: combinedTailwindConfig = getCombinedTailwindConfig($pageStyles.tailwind, $siteStyles.tailwind)

  let tailwindConfigChanged = false
  let gettingTailwind = false
  $: {
    if (tailwindConfigChanged) {
      loading = true
      gettingTailwind = true
      tailwind.swapInConfig(combinedTailwindConfig, () => {
        loading = false
        gettingTailwind = false 
        tailwindConfigChanged = false
      })
    }
  }

  const cachedTailwindConfig = moduleTailwindConfig.replace('export default ','')
  let shouldReloadTailwind = false

  $: {
    if (tailwindConfig !== cachedTailwindConfig) {
      shouldReloadTailwind = true
    }
  }

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

  $: if (showingPage) {
    styles = $pageStyles
  } else {
    styles = $siteStyles
  }

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

  function saveStyles() {
    if (showingPage) {
      $pageStyles = styles
    } else {
      $siteStyles = styles
    }
  }

  let view = 'large'

</script>

<ModalHeader 
  icon="fab fa-css3"
  title="CSS"
  button={{
    label: `Draft`,
    icon: 'fas fa-check',
    onclick: () => {
      tailwind.saveSwappedInConfig()
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
            on:change={_.debounce( async() => { 
              $pageStyles.final = await compileStyles($pageStyles.raw, $pageStyles.tailwind) 
            }, 1000 )}
            mode="css" 
            docs="https://adam-marsden.co.uk/css-cheat-sheet"
          />
        {:else if primaryTab.id === 'page' && secondaryTab.id === 'tw'}
          <CodeMirror 
            autofocus
            prefix="export default "
            bind:value={$pageStyles.tailwind} 
            on:change={_.debounce( async() => { 
              tailwindConfigChanged = true
              $pageStyles.final = await compileStyles($pageStyles.raw, $pageStyles.tailwind) 
            }, 1000 )}
            mode="javascript" 
            docs="https://tailwindcss.com/docs/configuration"
          />
        {:else if primaryTab.id === 'site' && secondaryTab.id === 'styles'}
          <CodeMirror 
            autofocus
            bind:value={$siteStyles.raw} 
            on:change={_.debounce( async() => { 
              $siteStyles.final = await compileStyles($siteStyles.raw, $siteStyles.tailwind) 
            }, 1000 )}
            mode="css" 
            docs="https://adam-marsden.co.uk/css-cheat-sheet"
          />
        {:else if primaryTab.id === 'site' && secondaryTab.id === 'tw'}
          <CodeMirror 
            autofocus
            prefix="export default "
            bind:value={$siteStyles.tailwind} 
            on:change={_.debounce( async() => { 
              tailwindConfigChanged = true
              $siteStyles.final = await compileStyles($siteStyles.raw, $siteStyles.tailwind) 
            }, 1000 )}
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
  <!-- <div class="flex justify-end py-2">
    <SaveButton {loading} on:click={() => {
      site.save({ styles: siteStyles })
      site.saveCurrentPage({ styles: pageStyles })
      if (shouldReloadTailwind) {
        tailwind.saveSwappedInConfig()
      } else {
        tailwind.swapOutConfig()
      }
      modal.hide()
    }}>Save</SaveButton>
  </div> -->
</div>


<!-- 
<br>
CSS Output ({cssSize} KB)
<CodeEditor 
  disabled={true}
  bind:value={finalStyles} 
  mode="css" 
  monacoOptions={{
    wordWrap: "on"
  }}
/> -->
