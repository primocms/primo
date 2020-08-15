<script>
  import { fade } from 'svelte/transition'
  import { createEventDispatcher, getContext } from 'svelte'
  import axios from 'axios'
  import {Spinner} from '../../@components/misc'
  import {PrimaryButton} from '../../@components/buttons'
  import {pageData, site} from '../../@stores/data'
  import {modal} from '../../@stores/app'
  import {buildPageHTML,buildPageStyles} from '../../utils'

  let loading = false
  let selection = 'Page'

  async function buildSelection() {

    const HTML = await buildPageHTML($pageData.content, true)
    const CSS = await buildPageStyles($pageData, $site, HTML)
    // const combinedCSS = get(site).styles.raw + rawPageStyles

    const pages = await Promise.all(
      $site.pages.map(async page => ({
        id: page.id,
        html: await buildPageHTML(page.content, true),
        css: await buildPageStyles($pageData, $site, HTML)
      }))
    )

    if (selection === 'Page') {
      buildSite([$pageData], $site)
    } else {
      buildSite(pages, $site)
    }

    // const endpoint = getContext('functions') + '/build'
    // try {
    //   loading = true
    //   const pages = selection === 'Page' ? [$pageData] : $site.pages
    //   const {data:result} = await axios.post(endpoint, {
    //     pages, 
    //     siteStyles: $site.styles
    //   })
    // } catch(e) {
    //   console.error(e)
    // }
    // loading = false
    // modal.hide()
  }
</script>

{#if !loading}
  <div class="toggle mt-2">
    <button class:selected={selection === 'Page'} type="button" on:click={() => selection = 'Page'}>Page</button>
    <button class:selected={selection === 'Site'} type="button" on:click={() => selection = 'Site'}>Site</button>
  </div>
  <div class="flex justify-end mt-4">
    <button class="build" on:click={buildSelection}>Build {selection}</button>
  </div>
{:else}
  <span class="w-full text-center block">Building {selection}</span>
  <Spinner />
{/if}

<style>
  .toggle {
    @apply flex mt-1 rounded-sm overflow-hidden;
  }
  .toggle > button {
    @apply flex-1 bg-gray-100 text-gray-700 py-2 font-medium transition-colors duration-200;
  }
  .toggle > button.selected {
    @apply bg-gray-800 text-gray-100 transition-colors duration-200 outline-none;
  }
  .build {
    @apply bg-codeblack transition-colors duration-200 text-white flex-1 py-2 rounded-sm font-semibold;
    &:hover {
      @apply bg-gray-900;
    }
  }
</style>