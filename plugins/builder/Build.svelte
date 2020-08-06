<svelte:options tag="primo-build"/>
<script>
  import { some } from 'lodash'
  import { fade } from 'svelte/transition'
  import { createEventDispatcher, getContext } from 'svelte'
  import axios from 'axios'
  import {buildPageHTML,buildPageStyles} from './utils'

  export let site
  export let onbuild = () => {}

  $: console.log('site', site)

  let loading = false
  let selection = 'Page'

  async function buildSelection() {

    const pages = await Promise.all(
      site.pages.map(async page => {
        const html = buildPageHTML(page, true)
        const css = await buildPageStyles(page, site, html)
        return { 
          id: page.id, 
          html, 
          css 
        }
      })
    )

    loading = true
    onbuild(pages, site)
    setTimeout(() => {
      loading = false
    }, 2000)

  }


</script>

{#if !loading}
  <div class="flex flex-col mt-4">
    <p class="mb-3">This will build your entire site (and overwrite any existing files) to <strong>Desktop/primo-build</strong></p>
    <button class="bg-gray-900 transition-colors duration-200 text-white flex-1 py-2 rounded-sm font-semibold hover:bg-gray-800" on:click={buildSelection}>Build site</button>
  </div>
{:else}
  <span class="w-full text-center block">Building site</span>
{/if}
