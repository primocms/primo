<script context="module">
  export const prerender = true;
</script>

<script>
  import {find, cloneDeep, flattenDeep} from 'lodash-es'
  import {onMount, setContext, tick} from 'svelte'
  import PureComponent from '@primo-app/primo/views/editor/Layout/PureComponent.svelte'
  import { wrapInStyleTags, processCode } from '@primo-app/primo/utils';
  import {getPageData, buildStaticPage} from '@primo-app/primo/stores/helpers'

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

  let activePage = ''
  function setupChannel() {
    channel.onmessage = (async ({data}) => {
      const { site:newSite, pageID:newPageID } = data
      if (!newSite || newSite.id === 'default') return
      const newPage = find(newSite.pages, ['id', newPageID]) // get Page to show
      activePage = await buildStaticPage({ page: newPage, site: newSite })
    })
    channel.postMessage('READY')
  }

</script>

{#key activePage}
  {#if activePage}
    <div id="page">
      {@html activePage}
    </div>
  {/if}
{/key}
