<script context="module">
  export const prerender = true;
</script>

<script>
  import {find, cloneDeep, flattenDeep} from 'lodash-es'
  import {onMount, setContext, tick} from 'svelte'
  import PureComponent from '@primo-app/primo/src/views/editor/Layout/PureComponent.svelte'
  import { wrapInStyleTags, processCode } from '@primo-app/primo/src/utils';
  import {getPageData} from '@primo-app/primo/src/stores/helpers'
  import {browser} from '$app/environment'

  let channel
  let html

  onMount(() => {
    channel = new BroadcastChannel('site_preview')

    import('../../compiler/processors').then(module => {
      html = module.html
      setupChannel()
    })
  })

  setContext('is-preview', true)

  function setupChannel() {
    channel.onmessage = (async ({data}) => {
      const { site:newSite, pageID:newPageID } = data
      if (!newSite || newSite.id === 'default') return
      const newPage = find(newSite.pages, ['id', newPageID]) // get Page to show
      const {css} = await await window.primo.processCSS(newSite.code.css + newPage.code.css); // process new Page's CSS
      const siteData = getPageData({ page: newPage, site: newSite })
      const code = await html({
        code: {
          html: `
            <svelte:head>
              ${newSite.code.html.head}${newPage.code.html.head}
              ${wrapInStyleTags(css)}
            </svelte:head>`,
          css: '',
          js: '',
        },
        data: siteData,
      })
      htmlHead = code.html
      site = cloneDeep(newSite)
      activePageID = newPageID
      activePage = find(site.pages, ['id', activePageID])

      setTimeout(() => {
        ready = true
      }, 100)
    })
    channel.postMessage('READY')
  }

  function hydrateInstance(block, symbols) {
    const symbol = find(symbols, ['id', block.symbolID]);
    return {
      ...symbol,
      id: block.id,
      type: block.type,
      symbolID: block.symbolID
    }
  }

  let site 
  let activePageID = 'index'

  let activePage
  // $: activePage = site ? find(site.pages, ['id', activePageID]) : null

  let ready

  let htmlHead = ''
</script>

{@html htmlHead}
{#key activePageID}
  {#if activePage}
    <div
      class:fadein={ready}
      id="page">
        {#each activePage.sections as section, i (section.id)}
          {#if section.symbolID}
            <PureComponent {site} block={hydrateInstance(section, site.symbols)} />
          {:else if section.type === 'content'}
            <PureComponent {site} block={section} />
          {/if}
        {/each}
    </div>
  {/if}
{/key}

<style>
  #page {
    transition: 0.1s opacity;
    opacity: 0;
  }

  #page.fadein {
    opacity: 1;
  }
</style>