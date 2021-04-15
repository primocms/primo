<script>
  import _ from 'lodash'
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
  import modal from '../../stores/app/modal'

  import {styles as pageStyles} from '../../stores/app/activePage'
  import {site, styles as siteStyles, pages} from '../../stores/data/draft'
  import { buildPagePreview } from '../../stores/helpers';

  function buildPreview(siteCSS, pageCSS, content) {

  }

  let refreshPreview

  let pagePreview = {
    html: ``,
    css: ``,
    js: ``,
    tailwind: {}
  }

  getNewPagePreview()
  async function getNewPagePreview() {
    pagePreview = await buildPagePreview({
      page: $activePage,
      site: $site,
      separate: true
    })
  }

  let allPages = []
  buildSitePreview()
  async function buildSitePreview() {
    allPages = await Promise.all(
      $pages.map(page => buildPagePreview({ page, site: $site, separate: true }))
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
            on:change={() => {
              loading = true
              slowDebounce([compileStyles, {
                styles: $pageStyles,
                onCompile: (css) => {
                  $pageStyles.final = css
                  getNewPagePreview()
                }
              }])
            }}
          />
        {:else if primaryTab.id === 'page' && secondaryTab.id === 'tw'}
          <CodeMirror 
            autofocus
            prefix="module.exports = "
            bind:value={$pageStyles.tailwind} 
            on:change={() => {
              loading = true
              quickDebounce([() => {
                tailwindConfigChanged = true
                getNewPagePreview()
              }])
            }}
            mode="javascript" 
            docs="https://tailwindcss.com/docs/configuration"
          />
        {:else if primaryTab.id === 'site' && secondaryTab.id === 'styles'}
          <CodeMirror 
            autofocus
            bind:value={$siteStyles.raw} 
            mode="css" 
            docs="https://adam-marsden.co.uk/css-cheat-sheet"
            on:change={() => {
              loading = true
              quickDebounce([compileStyles, {
                styles: $siteStyles,
                onCompile: (css) => {
                  $siteStyles.final = css
                  buildSitePreview()
                }
              }])
            }}
          />
        {:else if primaryTab.id === 'site' && secondaryTab.id === 'tw'}
          <CodeMirror 
            autofocus
            prefix="module.exports = "
            bind:value={$siteStyles.tailwind} 
            on:change={() => {
              loading = true
              tailwindConfigChanged = true
              slowDebounce([compileStyles, {
                styles: $siteStyles,
                onCompile: (css) => {
                  $siteStyles.final = css
                  buildSitePreview()
                }
              }])
            }}
            mode="javascript" 
            docs="https://tailwindcss.com/docs/configuration"
          />
        {/if} 
    </div>
    <div class="w-1/2">
      {#if primaryTab.id === 'page'}
        <CodePreview 
          bind:view
          bind:refreshPreview
          html={pagePreview.html}
          css={pagePreview.css}
          js={pagePreview.js}
          tailwind={getCombinedTailwindConfig($pageStyles.tailwind, $siteStyles.tailwind, true)}
        />
      {:else}
        {#each allPages as page}
          <CodePreview 
            bind:view
            bind:refreshPreview
            html={page.html}
            css={page.css}
            js={page.js}
            tailwind={getCombinedTailwindConfig($pageStyles.tailwind, $siteStyles.tailwind, true)}
            hideControls={true}
          />
        {/each}
      {/if}
    </div>
  </div>
</div>