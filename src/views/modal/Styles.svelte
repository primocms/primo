<script>
  import {cloneDeep,isEqual} from 'lodash'
  import {CodeMirror} from '../../components'
  import {Tabs} from '../../components/misc'
  import {CodePreview} from '../../components/misc'
  import { wrapInStyleTags, createDebouncer } from '../../utils'
  import ModalHeader from './ModalHeader.svelte'
  import {processors} from '../../component'

  const quickDebounce = createDebouncer(500);
  const slowDebounce = createDebouncer(1000)

  import tailwind, {getCombinedTailwindConfig} from '../../stores/data/tailwind'
  import activePage, {content,id} from '../../stores/app/activePage'
  import {unsaved} from '../../stores/app/misc'
  import modal from '../../stores/app/modal'
  import {pages} from '../../stores/actions'

  import {styles as pageStyles} from '../../stores/app/activePage'
  import {site, styles as siteStyles, pages as pagesStore} from '../../stores/data/draft'
  import { buildPagePreview } from '../../stores/helpers';

  const localPageStyles = cloneDeep($pageStyles)
  const localSiteStyles = cloneDeep($siteStyles)

  let refreshPreview

  let pagePreview = {
    html: ``,
    css: ``,
    js: ``,
    tailwind: {}
  }

  getNewPagePreview()
  async function getNewPagePreview() {
    console.log('getting new preview')
    pagePreview = await buildPagePreview({
      page: {
        ...$activePage,
        styles: localPageStyles
      },
      site: $site,
      separate: true,
    })
    console.log({pagePreview})
  }

  let allPages = []
  buildSitePreview()
  async function buildSitePreview() {
    allPages = await Promise.all(
      $pagesStore.map(page => buildPagePreview({ page, site: $site, separate: true }))
    )
  }

  let loading = false
  let tailwindConfigChanged = false

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

  async function compileStyles({ styles, onCompile }) {
    const result = await processors.css(
      styles.raw, 
      {
        tailwind: styles.tailwind
      }
    );
    loading = false
    if (!result.error) {
      onCompile(result)
      if (tailwindConfigChanged) {
        const combinedTailwindConfig = getCombinedTailwindConfig(localPageStyles.tailwind, localSiteStyles.tailwind)
        tailwind.swapInConfig(combinedTailwindConfig, () => {
          tailwindConfigChanged = false
        })
      }
    } 
  }

  async function saveStyles() {
    $siteStyles = localSiteStyles
    pages.update($id, page => ({
      ...page,
      styles: localPageStyles
    }))
    $unsaved = true
    modal.hide()
  }

</script>

<ModalHeader 
  icon="fab fa-css3"
  title="CSS"
  button={{
    label: `Draft`,
    icon: 'fas fa-check',
    onclick: saveStyles,
    loading
  }}
  warn={() => {
    if (!isEqual(localPageStyles, $pageStyles) || !isEqual(localSiteStyles, $siteStyles)) {
      const proceed = window.confirm('Undrafted changes will be lost. Continue?')
      return proceed
    } else return true
  }}
  variants="mb-4"
/>

<div class="h-full flex flex-col">
  <div class="grid md:grid-cols-2 flex-1">
    <div class="flex flex-col">
        <Tabs tabs={primaryTabs} bind:activeTab={primaryTab} variants="mb-2" />
        <Tabs tabs={secondaryTabs} bind:activeTab={secondaryTab} variants="secondary" />
        {#if primaryTab.id === 'page' && secondaryTab.id === 'styles'}
          <CodeMirror 
            autofocus
            bind:value={localPageStyles.raw} 
            mode="css" 
            docs="https://adam-marsden.co.uk/css-cheat-sheet"
            debounce={true}
            on:debounce={() => {
              if (!loading) {
                loading = true
              } 
            }}
            on:change={() => {
              console.log('localPageStyles')
              compileStyles({
                styles: localPageStyles,
                onCompile: async (css) => {
                  localPageStyles.final = css
                  await getNewPagePreview()
                  loading = false
                }
              })
            }}
            on:save={saveStyles}
          />
        {:else if primaryTab.id === 'page' && secondaryTab.id === 'tw'}
          <CodeMirror 
            autofocus
            prefix="module.exports = "
            bind:value={localPageStyles.tailwind} 
            debounce={true}
            on:debounce={() => {
              if (!loading) {
                loading = true
              } 
            }}
            on:change={async () => {
              tailwindConfigChanged = true
              await getNewPagePreview()
              loading = false
            }}
            on:save={saveStyles}
            mode="javascript" 
            docs="https://tailwindcss.com/docs/configuration"
          />
        {:else if primaryTab.id === 'site' && secondaryTab.id === 'styles'}
          <CodeMirror 
            autofocus
            bind:value={localSiteStyles.raw} 
            mode="css" 
            docs="https://adam-marsden.co.uk/css-cheat-sheet"
            debounce={true}
            on:debounce={() => {
              if (!loading) {
                loading = true
              } 
            }}
            on:change={() => {
              compileStyles({
                styles: localSiteStyles,
                onCompile: async (css) => {
                  localSiteStyles.final = css
                  await buildSitePreview()
                  loading = false
                }
              })
            }}
            on:save={saveStyles}
          />
        {:else if primaryTab.id === 'site' && secondaryTab.id === 'tw'}
          <CodeMirror 
            autofocus
            prefix="module.exports = "
            bind:value={localSiteStyles.tailwind} 
            debounce={true}
            on:debounce={() => {
              if (!loading) {
                loading = true
              } 
              if (!tailwindConfigChanged) {
                tailwindConfigChanged = true
              }
            }}
            on:change={() => {
              compileStyles({
                styles: localSiteStyles,
                onCompile: async (css) => {
                  localSiteStyles.final = css
                  await buildSitePreview()
                  loading = false
                }
              })
            }}
            on:save={saveStyles}
            mode="javascript" 
            docs="https://tailwindcss.com/docs/configuration"
          />
        {/if} 
    </div>
    <div class="h-96 md:h-auto">
      {#if primaryTab.id === 'page'}
        <CodePreview 
          bind:view
          bind:refreshPreview
          html={pagePreview.html}
          css={pagePreview.css}
          js={pagePreview.js}
          tailwind={pagePreview.tailwind}
        />
      {:else}
        {#each allPages as page}
          <CodePreview 
            bind:view
            bind:refreshPreview
            html={page.html}
            css={page.css}
            js={page.js}
            tailwind={page.tailwind}
            hideControls={true}
          />
        {/each}
      {/if}
    </div>
  </div>
</div>