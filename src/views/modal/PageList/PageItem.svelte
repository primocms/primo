<script>
  import { onMount, createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  import { router } from 'tinro'
  // import { navigate } from "svelte-routing";
  import { wrapInStyleTags, convertFieldsToData } from '../../../utils'
  import { styles as siteStyles } from '../../../stores/data/draft'
  import modal from '../../../stores/app/modal'
  import components from '../../../stores/app/components'
  import {processors} from '../../../component'
  import {getSymbol, getTailwindConfig, getAllFields, buildPagePreview} from '../../../stores/helpers'
  import {site} from '../../../stores/data/draft'
  import 'requestidlecallback-polyfill'

  export let page
  export let active = false
  export let disableAdd = falses

  let preview = ''
  buildPreview()
  async function buildPreview() {
    preview = await buildPagePreview({ page, site: $site })
  }

  let iframeLoaded = false

  let container
  let iframe
  let scale

  function resizePreview() {
    const { clientWidth: parentWidth } = container
    const { clientWidth: childWidth } = iframe
    scale = parentWidth / childWidth
  }

  $: if (iframe) {
    resizePreview()
  }

  function openPage(e) {
    e.preventDefault()
    modal.hide()

    const [_, user, repo] = $router.path.split('/')

    router.goto(`/${user}/${repo}/${page.id === 'index' ? '' : page.id}`)

    // if (user === 'try') {
    //   console.log('try')
    //   const url = `${window.location.origin}/try/${page.id === 'index' ? '' : page.id }/${hash}`
    //   console.log({ user, repo, pageId, url })
    //   console.log({url})
    //   // navigate(url) // TODO
    // } else {
    //   console.log('normal')
    //   const url = `${window.location.origin}/${user}/${repo}/${page.id === 'index' ? '' : page.id }/${hash}`
    //   console.log({url})
    //   // navigate(url) // TODO
    // }
  }

  let shouldLoadIframe = false
  onMount(() => {
    window.requestIdleCallback(() => {
      shouldLoadIframe = true
    })
  })
</script>

<svelte:window on:resize={resizePreview} />
<div class="shadow-lg rounded overflow-hidden border-gray-900">
  <div class="text-gray-200 bg-codeblack w-full flex justify-between px-3 py-2">
    <div>
      <span class="text-xs font-semibold">{page.title}</span>
    </div>
    <div class="flex justify-end">
      {#if page.pages && !disableAdd}
        <button
          title="Show sub-pages"
          on:click={() => dispatch('list')}
          class="p-1 text-xs"
        >
          <i class="fas fa-th-large" />
        </button>
      {:else if page.id !== 'index' && !disableAdd}
        <button
          title="Add sub-page"
          on:click={() => dispatch('add')}
          class="p-1 text-xs"
        >
          <i class="fas fa-plus" />
        </button>
      {/if}
      {#if page.id !== 'index'}
        <button
          title="Delete page"
          on:click={() => dispatch('delete')}
          class="ml-1 p-1 delete-page text-xs text-red-500 hover:text-red-600"
        >
          <i class="fas fa-trash" />
        </button>
      {/if}
    </div>
  </div>
  <a
    tinro-ignore
    class="page-container"
    href="/{page.id}"
    on:click={openPage}
    class:active
    bind:this={container}
    aria-label="Go to /{page.id}"
  >
    {#if shouldLoadIframe}
      <iframe
        bind:this={iframe}
        style="transform: scale({scale})"
        class:fadein={iframeLoaded}
        title="page preview"
        srcdoc={preview}
        on:load={() => {
          iframeLoaded = true
        }}
      />
    {/if}
  </a>
</div>

<style>
  a.page-container.active {
    @apply cursor-default pointer-events-none opacity-50;
  }
  a.page-container.active:after {
    @apply opacity-50;
  }
  a.page-container {
    @apply bg-white cursor-pointer block w-full relative overflow-hidden transition-colors duration-100;
    height: 15vh;
  }

  a.page-container:after {
    content: '';
    @apply absolute top-0 left-0 right-0 bottom-0 bg-codeblack opacity-0 transition-opacity duration-100;
    pointer-events: all;
  }

  a.page-container:hover:after {
    @apply opacity-50;
  }
  iframe {
    @apply pointer-events-none opacity-0 transition-opacity duration-200;
    width: 100vw;
    transform-origin: top left;
    height: 1000vh;
  }
  .fadein {
    @apply opacity-100;
  }
</style>
