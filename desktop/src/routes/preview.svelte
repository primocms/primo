<script>
  import {find, cloneDeep} from 'lodash-es'
  import {onMount} from 'svelte'
  import PureComponent from '@primo-app/primo/src/views/editor/Layout/PureComponent.svelte'
  import { hydrateSite } from '@primo-app/primo/src/stores/actions';
  import { processCSS, wrapInStyleTags, processCode } from '@primo-app/primo/src/utils';

  let channel
  onMount(() => {
    channel = new BroadcastChannel('site_preview')
    setupChannel()
  })

  function setupChannel() {
    channel.onmessage = (async ({data}) => {
      site = cloneDeep(data.site)
      page = find(site.pages, ['id', data.pageID])
      hydrateSite(site)
      const css = await processCSS(site.code.css + page.code.css);
      const code = await processCode({
        code: {
          html: `
            <svelte:head>
              ${site.code.html.head}${page.code.html.head}
              ${wrapInStyleTags(css)}
            </svelte:head>`,
          css: '',
          js: '',
        },
        data,
      })
      htmlHead = code.html
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
  let page

  let ready

  let htmlHead = ''
</script>

{@html htmlHead}
<div
  class:fadein={ready}
  class="primo-page being-edited">
  {#if page}
    {#each page.sections as block, i (block.id)}
      {#if block.symbolID}
        <PureComponent
          block={hydrateInstance(block, site.symbols)}
        />
      {:else if block.type === 'content'}
        <PureComponent on:save {block} />
      {/if}
    {/each}
  {/if}
</div>

<style>
  .primo-page {
    transition: 0.1s opacity;
    opacity: 0;
  }

  .fadein {
    opacity: 1;
  }
</style>