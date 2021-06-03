<script>
  import {fade} from 'svelte/transition'
  import { onMount, createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
  import { TextInput } from "../../../components/inputs";
  import { PrimaryButton } from "../../../components/buttons";

  import { router } from 'tinro'
  import modal from '../../../stores/app/modal'
  import {buildPagePreview} from '../../../stores/helpers'
  import {site} from '../../../stores/data/draft'
  import 'requestidlecallback-polyfill'

  export let page
  export let active = false
  export let disableAdd = false

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

    if (user === 'try') {
      router.goto(`/try/${page.id === 'index' ? '' : page.id }`)
    } else {
      router.goto(`/${user}/${repo}/${page.id === 'index' ? '' : page.id}`)
    }
  }

  let shouldLoadIframe = false
  onMount(() => {
    window.requestIdleCallback(() => {
      shouldLoadIframe = true
    })
  })

  let editingPage = false
  let title = page.title || ''
  let id = page.id || ''
  $: disableSave = !title || !id

</script>

<svelte:window on:resize={resizePreview} />
<li class="shadow-lg rounded overflow-hidden border-gray-900">
  <div class="text-gray-200 bg-codeblack w-full flex justify-between px-3 py-2">
    <div>
      <span class="text-xs font-semibold">{page.title}</span>
    </div>
    <div class="flex justify-end">
      <button
        title="Edit"
        on:click={() => editingPage = !editingPage}
        class="p-1 text-xs hover:text-primored"
      >
        <i class="fas fa-edit" />
      </button>
      {#if page.pages && !disableAdd}
        <button
          title="Show sub-pages"
          on:click={() => dispatch('list')}
          class="p-1 text-xs hover:text-primored"
        >
          <i class="fas fa-th-large" />
        </button>
      {:else if page.id !== 'index' && !disableAdd}
        <button
          title="Add sub-page"
          on:click={() => dispatch('add')}
          class="p-1 text-xs hover:text-primored"
        >
          <i class="fas fa-plus" />
        </button>
      {/if}
      {#if page.id !== 'index'}
        <button
          title="Delete page"
          on:click={() => dispatch('delete')}
          class="ml-1 p-1 delete-page text-xs text-red-400 hover:text-primored"
        >
          <i class="fas fa-trash" />
        </button>
      {/if}
    </div>
  </div>
  {#if editingPage}
    <div class="p-4">
      <form on:submit|preventDefault={() => {
        editingPage = false
        dispatch('edit', { title, id })
      }} in:fade={{ duration: 100 }}>
        <TextInput
          bind:value={title}
          id="page-label"
          autofocus={true}
          variants="mb-2 text-xs"
          label="Page Label"
          placeholder="About Us" />
          {#if id !== 'index'}
            <TextInput
              bind:value={id}
              id="page-url"
              variants="mb-2 text-xs"
              label="Page URL"
              prefix="/"
              placeholder="about-us" />
          {/if}
        <PrimaryButton disabled={disableSave} id="save-page" type="submit">Save</PrimaryButton>
      </form>
    </div>
  {:else}
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
  {/if}
</li>

<style>
  button {
    @apply transition-colors duration-100 focus:outline-none;
  }
  .page-container.active {
    @apply cursor-default pointer-events-none opacity-50;
  }
  .page-container.active:after {
    @apply opacity-50;
  }
  .page-container {
    @apply bg-white cursor-pointer block w-full relative overflow-hidden transition-colors duration-100;
    height: 20vh;
  }

  /* .page-container:after {
    content: '';
    @apply absolute top-0 left-0 right-0 bottom-0 bg-codeblack opacity-0 transition-opacity duration-100;
    pointer-events: all;
  } */

  .page-container:hover {
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
