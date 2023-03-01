<script>
  import { fade } from 'svelte/transition'
  import { find, isEqual, cloneDeep } from 'lodash-es'
  import Block from './Layout/Block.svelte'
  import Spinner from '../../ui/misc/Spinner.svelte'
  import {
    pages,
    symbols,
    code as siteCode,
    id as siteID,
    content,
  } from '../../stores/data/draft'
  import { locale } from '../../stores/app/misc'
  import { updatePreview } from '../../stores/actions'
  import {
    id as pageID,
    sections,
    fields as pageFields,
    code as pageCode,
  } from '../../stores/app/activePage'
  import { processCode, processCSS, wrapInStyleTags } from '../../utils'
  import { getPageData } from '../../stores/helpers'
  import en from '../../languages/en.json'
  import { init, addMessages } from 'svelte-i18n'

  addMessages('en', en)
  init({
    fallbackLocale: 'en',
    initialLocale: 'en',
  })

  export let id = 'index'
  $: $pageID = id

  let element

  $: pageExists = findPage(id, $pages)
  function findPage(id, pages) {
    const [root] = id.split('/')
    const rootPage = find(pages, ['id', root])
    const childPage = rootPage ? find(rootPage?.pages, ['id', id]) : null
    return childPage || rootPage
  }

  function hydrateInstance(block, symbols) {
    const symbol = find(symbols, ['id', block.symbolID])
    return {
      ...symbol,
      id: block.id,
      type: block.type,
      symbolID: block.symbolID,
    }
  }

  $: set_page_content(id, $pages)
  function set_page_content(id, pages) {
    const [root, child] = id.split('/')
    const rootPage = find(pages, ['id', root])
    if (rootPage && !child) {
      setPageStore(rootPage)
    } else if (rootPage && child) {
      const childPage = find(rootPage.pages, ['id', id])
      if (childPage) setPageStore(childPage)
    } else {
      console.warn('Could not navigate to page', id, pages)
    }

    if (page_mounted) updatePreview()

    function setPageStore(page) {
      $sections = page.sections
      $pageFields = page.fields
      $pageCode = page.code
    }
  }

  let html_head = ''
  let html_below = ''
  let cached = { pageCode: null, siteCode: null }
  $: $content, set_page_html($pageCode, $siteCode)
  async function set_page_html(pageCode, siteCode) {
    if (
      isEqual(pageCode, cached.pageCode) &&
      isEqual(siteCode, cached.siteCode)
    )
      return
    cached.pageCode = pageCode
    cached.siteCode = siteCode
    const css = await processCSS(siteCode.css + pageCode.css)
    const data = getPageData({})
    const [head, below] = await Promise.all([
      processCode({
        component: {
          html: `<svelte:head>
            ${siteCode.html.head}${pageCode.html.head}
            ${wrapInStyleTags(css)}
          </svelte:head>`,
          css: '',
          js: '',
          data,
        },
      }),
      processCode({
        component: {
          html: siteCode.html.below + pageCode.html.below,
          css: '',
          js: '',
          data,
        },
      }),
    ])
    html_head = !head.error ? head.head : ''
    html_below = !below.error ? below.html : ''
  }

  // Fade in page when all components mounted
  let page_mounted = false
  $: page_is_empty =
    $sections.length <= 1 &&
    $sections.length !== 0 &&
    $sections[0]['type'] === 'options'

  // detect when all sections are mounted
  let sections_mounted = 0
  $: if ($siteID !== 'default' && sections_mounted === $sections.length) {
    page_mounted = true
  }
</script>

<svelte:head>
  {@html html_head || ''}
</svelte:head>

{#if !page_mounted}
  <div class="spinner-container" out:fade={{ duration: 200 }}>
    <Spinner />
  </div>
{/if}
<div bind:this={element} id="page" class:fadein={page_mounted} lang={$locale}>
  {#if pageExists}
    {#each $sections as block, i (block.id)}
      {#if block.symbolID}
        <Block
          {i}
          block={hydrateInstance(block, $symbols)}
          on:mount={() => sections_mounted++}
        />
      {:else}
        <Block on:save on:mount={() => sections_mounted++} {block} {i} />
      {/if}
    {:else}
      <Block block={{ type: 'options' }} />
    {/each}
  {/if}
</div>
{@html html_below || ''}

{#if page_is_empty}
  <div class="empty-state">
    if you're seeing this, <br />your website is empty
  </div>
{/if}

<style lang="postcss">
  .spinner-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5;

    --Spinner-color: var(--primo-color-brand);
    --Spinner-color-opaque: rgba(248, 68, 73, 0.2);
  }
  #page {
    transition: 0.1s opacity;
    opacity: 0;
    border-top: 0;
    height: calc(100vh - 52px);
    overflow: auto;
  }

  #page.fadein {
    opacity: 1;
  }

  .empty-state {
    position: absolute;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--color-gray-4);
    pointer-events: none;
    z-index: -2;
    font-family: Satoshi, sans-serif;
  }
</style>
