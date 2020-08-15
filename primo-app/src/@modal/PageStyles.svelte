<script>
  import {createEventDispatcher, onMount, onDestroy} from 'svelte'
  const dispatch = createEventDispatcher()
  import _ from 'lodash'
  import {CodeMirror} from '../@components'
  import {Tabs} from '../@components/misc'
  import {CodePreview} from '../@components/misc'
  import {SaveButton} from '../@components/buttons'
  import { compileScss, processStyles, wrapInStyleTags, buildPageHTML, getComponentCSS } from '../utils'
  import { tailwindConfig as defaultTw, pageStyles as defaultStyles } from '../const'

  import {pageData,settings,site,tailwind} from '../@stores/data'
  import {content} from '../@stores/data/page'
  import {modal} from '../@stores/app'

  let { styles:pageStyles } = $pageData

  let pageHTML
  let allComponentStyles = getComponentCSS($content)

  onMount(async() => {
    pageHTML = await buildPageHTML($content)
  })

  let loading = false

  async function compileStyles() {
    loading = true
    const result = await processStyles(
      unprocessedStyles, 
      '',
      {
        tailwindConfig: JSON.stringify(combinedTailwindConfig), 
        purge: false,
        includeBase: false,
        includeTailwind: false
      }
    );
    if (!result.error) {
      processedStyles = result
      if (!gettingTailwind) {
        loading = false
      } 
    } 
  }

  let unprocessedStyles = pageStyles.raw || '';
  let processedStyles = pageStyles.final || ''; 
  let moduleTailwindConfig = pageStyles.tailwind || defaultTw;

  $: tailwindConfig = moduleTailwindConfig.replace('export default ','')
  $: combinedTailwindConfig = tailwind.getCombinedConfig(tailwindConfig)

  let tailwindConfigChanged = false
  let gettingTailwind = false
  $: {
    if (tailwindConfigChanged) {
      loading = true
      gettingTailwind = true
      tailwind.swapInConfig(combinedTailwindConfig, () => {
        loading = false
        gettingTailwind = false 
      })
    }
  }

  const cachedTailwindConfig = moduleTailwindConfig.replace('export default ','')
  let shouldReloadTailwind = false

  $: {
    pageStyles = {
      raw: unprocessedStyles,
      final: processedStyles,
      tailwind: tailwindConfig
    }
    if (tailwindConfig !== cachedTailwindConfig) {
      shouldReloadTailwind = true
    }
  }

  $: cssSize = (new Blob([processedStyles]).size / 1000).toFixed(1)

  const tabs = [
    {
      id: 'styles',
      label: 'CSS'
    },
    {
      id: 'tw',
      label: 'Tailwind Config'
    },
  ]

  let selectedTab = tabs[0]

  $: combinedStyles = $site.styles.final + processedStyles + allComponentStyles


</script>

<div class="h-full flex flex-col">
  <div class="flex flex-row flex-1">
    <div class="w-1/2 flex-1 flex flex-col">
      <Tabs {tabs} bind:activeTab={selectedTab} />
        {#if selectedTab.id === 'styles'}
          <CodeMirror 
            bind:value={unprocessedStyles} 
            on:change={_.debounce( () => { compileStyles() }, 1000 )}
            mode="css" 
          />
        {:else}
          <CodeMirror 
            prefix="export default "
            bind:value={moduleTailwindConfig} 
            on:change={_.debounce( () => { 
              tailwindConfigChanged = true
              compileStyles() 
            }, 1000 )}
            mode="javascript" 
          />
        {/if} 
    </div>
    <div class="w-1/2 flex-1">
      <CodePreview 
        html={pageHTML} 
        css={combinedStyles} 
      />
    </div>
  </div>
  <div class="flex justify-end py-2">
    <SaveButton {loading} on:click={() => {
      pageData.saveStyles(pageStyles)
      if (shouldReloadTailwind) {
        tailwind.saveSwappedInConfig()
      } else {
        tailwind.swapOutConfig()
      }
      modal.hide()
    }}>Save</SaveButton>
  </div>
</div>


<!-- 
<br>
CSS Output ({cssSize} KB)
<CodeEditor 
  disabled={true}
  bind:value={processedStyles} 
  mode="css" 
  monacoOptions={{
    wordWrap: "on"
  }}
/> -->