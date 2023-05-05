<script context="module">
  import { writable } from 'svelte/store'
  export const autoRefresh = writable(true)
</script>

<script>
  import { onMount, tick } from 'svelte'
  import { slide, fade } from 'svelte/transition'
  import { iframePreview } from './misc'
  import { locale, highlightedElement } from '../../stores/app/misc'
  import JSONTree from 'svelte-json-tree'
  import Icon from '@iconify/svelte'
  import { content_editable } from '$lib/editor/utilities'

  export let view = 'small'
  export let orientation = 'horizontal'
  export let loading = false
  export let hideControls = false
  export let componentApp = null
  export let preview = null
  export let error = null
  export let data = {}

  let channel
  onMount(() => {
    channel = new BroadcastChannel('component_preview')
    channel.onmessage = ({ data }) => {
      const { event, payload } = data
      if (event === 'BEGIN') {
        consoleLog = null
      } else if (event === 'SET_CONSOLE_LOGS') {
        consoleLog = data.payload.logs
      } else if (event === 'SET_ELEMENT_PATH' && payload.loc) {
        $highlightedElement = payload.loc
      }
    }
  })

  let consoleLog

  let iframe
  $: if (iframe) {
    // open clicked links in browser
    iframe.contentWindow.document.querySelectorAll('a').forEach((link) => {
      link.target = '_blank'
    })
  }

  let container
  let iframeLoaded = false

  let scale
  let height
  async function resizePreview() {
    if (view && container && iframe) {
      await tick()
      const { clientWidth: parentWidth } = container
      const { clientWidth: childWidth } = iframe
      const scaleRatio = parentWidth / childWidth
      scale = `scale(${scaleRatio})`
      height = 100 / scaleRatio + '%'
    }
  }

  function cycle_preview() {
    if (active_static_width === static_widths.phone) {
      set_preview(static_widths.tablet)
    } else if (active_static_width === static_widths.tablet) {
      set_preview(static_widths.laptop)
    } else if (active_static_width === static_widths.laptop) {
      set_preview(static_widths.desktop)
    } else {
      set_preview(static_widths.phone)
    }
    resizePreview()
  }

  function set_preview(size) {
    active_static_width = size
  }

  async function changeView() {
    if (view === 'small') {
      view = 'large'
      resizePreview()
    } else {
      view = 'small'
    }
  }

  $: componentData = data

  $: componentApp &&
    setIframeApp({
      iframeLoaded,
      componentApp,
    })
  function setIframeApp({ iframeLoaded, componentApp }) {
    if (iframeLoaded) {
      channel.postMessage({
        event: 'SET_APP',
        payload: { componentApp, componentData },
      })
    }
  }

  $: setIframeData(componentData)
  function setIframeData(componentData) {
    if (iframeLoaded) {
      channel.postMessage({
        event: 'SET_APP_DATA',
        payload: { componentData },
      })
    }
  }

  function setLoading() {
    if (!iframeLoaded) {
      iframeLoaded = true
      return
    }
    iframeLoaded = false
    iframe.srcdoc = iframePreview($locale)
  }

  let previewWidth
  $: previewWidth, resizePreview()

  const static_widths = {
    phone: 300,
    tablet: 600,
    laptop: 1200,
    desktop: 1600,
  }
  let active_static_width = static_widths.laptop

  $: active_dynamic_icon = getIcon(previewWidth)
  $: active_static_icon = getIcon(active_static_width)
  function getIcon(width) {
    if (width < static_widths.tablet) {
      return 'bi:phone'
    } else if (width < static_widths.laptop) {
      return 'ant-design:tablet-outlined'
    } else if (width < static_widths.desktop) {
      return 'bi:laptop'
    } else {
      return 'akar-icons:desktop-device'
    }
  }

  function toggleOrientation() {
    if (orientation === 'vertical') {
      orientation = 'horizontal'
    } else if (orientation === 'horizontal') {
      orientation = 'vertical'
    }
  }
</script>

<div class="code-preview">
  {#if error}
    <pre transition:slide={{ duration: 100 }} class="error-container">
      {@html error}
    </pre>
  {/if}

  {#if consoleLog}
    <div class="logs" transition:slide>
      <div class="log">
        {#if typeof consoleLog === 'object'}
          <JSONTree value={consoleLog} />
        {:else}
          <pre>{@html consoleLog}</pre>
        {/if}
      </div>
    </div>
  {/if}
  <div
    in:fade
    class="preview-container"
    class:loading
    bind:this={container}
    bind:clientWidth={previewWidth}
  >
    {#if componentApp}
      <iframe
        style:transform={view === 'large' ? scale : ''}
        style:height={view === 'large' ? height : '100%'}
        style:width={view === 'large' ? `${active_static_width}px` : '100%'}
        on:load={setLoading}
        title="Preview HTML"
        srcdoc={iframePreview($locale)}
        bind:this={iframe}
      />
    {:else}
      <iframe
        style:transform={view === 'large' ? scale : ''}
        style:height={view === 'large' ? height : '100%'}
        style:width={view === 'large' ? `${active_static_width}px` : '100%'}
        on:load={() => (iframeLoaded = true)}
        title="Preview"
        srcdoc={preview}
        bind:this={iframe}
      />
    {/if}
  </div>
  {#if !hideControls}
    <div class="footer-buttons">
      <div class="preview-width">
        {#if view === 'large'}
          <button on:click={cycle_preview}>
            <Icon icon={active_static_icon} height="1rem" />
          </button>
          <button>
            <div
              class="static-width"
              use:content_editable={{
                on_change: (e) => {
                  active_static_width = Number(e.target.textContent)
                  resizePreview()
                },
              }}
            >
              {active_static_width}
            </div>
          </button>
        {:else}
          <span>
            <Icon icon={active_dynamic_icon} height="1rem" />
          </span>
          <span>
            {previewWidth}
          </span>
        {/if}
      </div>
      <button class="switch-view" on:click={changeView}>
        <i
          class="fas {view === 'small'
            ? 'fa-compress-arrows-alt'
            : 'fa-expand-arrows-alt'}"
        />
        {#if view === 'large'}
          <span>static width</span>
        {:else}
          <span>dynamic width</span>
        {/if}
      </button>
      <button on:click={toggleOrientation} class="preview-orientation">
        {#if orientation === 'vertical'}
          <Icon icon="charm:layout-rows" />
        {:else if orientation === 'horizontal'}
          <Icon icon="charm:layout-columns" />
        {/if}
      </button>
      <button
        title="Toggle auto-refresh (refresh with Command R)"
        class="auto-refresh"
        class:toggled={$autoRefresh}
        on:click={() => ($autoRefresh = !$autoRefresh)}
      >
        <Icon icon="bx:refresh" />
      </button>
    </div>
  {/if}
</div>

<svelte:window on:resize={resizePreview} />

<style lang="postcss">
  .code-preview {
    height: 100%;
    display: flex;
    flex-direction: column;

    .error-container {
      color: var(--primo-color-white);
      background: red;
      padding: 5px;
    }

    .logs {
      --json-tree-font-family: 'Fira Code', serif, monospace;
      --json-tree-label-color: #569cd6;

      display: grid;
      gap: 0.5rem;
      background: var(--color-gray-9);
      border: 2px solid var(--color-gray-8);
      padding: 0.75rem 1rem;

      pre {
        display: block;
      }

      .log:not(:only-child):not(:last-child) {
        padding-bottom: 0.5rem;
        border-bottom: 1px solid rgba(250, 250, 250, 0.2);
      }
    }
  }
  iframe {
    border: 0;
    transition: opacity 0.4s;
    background: var(--primo-color-white);
    height: 100%;
    width: 100%;
    opacity: 1;
    transform-origin: top left;
  }
  .preview-container {
    background: var(--primo-color-white);
    border: 2px solid var(--color-gray-8);
    overflow: hidden;
    transition: border-color 0.2s;
    will-change: border-color;
    border-bottom: 0;
    flex: 1;
  }
  .preview-container.loading {
    border-color: var(--color-gray-7);
  }
  .footer-buttons {
    display: flex;
    flex-wrap: wrap;

    .preview-width {
      background: var(--primo-color-black);
      font-weight: 500;
      z-index: 10;
      display: flex;
      align-items: center;

      span {
        padding: 0.5rem;
        font-size: 0.75rem;
        border: 1px solid var(--color-gray-9);
        background: var(--color-gray-9);

        &:first-child {
          padding-right: 0;
        }

        &:last-child {
          padding-left: 0.25rem;
        }
      }

      .static-width {
        &:focus-visible {
          outline: none;
        }
        &::selection {
          background: var(--color-gray-7);
        }
      }
    }

    .switch-view {
      flex: 1;
    }

    .preview-orientation {
      font-size: 1.25rem;
      padding: 0.25rem 0.5rem;
    }

    .auto-refresh {
      font-size: 1.5rem;
      padding: 0.25rem 0.5rem;
      opacity: 0.5;

      &.toggled {
        opacity: 1;
      }
    }
  }

  .footer-buttons {
    button {
      outline: 0;
      background: var(--color-gray-9);
      border: 1px solid var(--color-gray-8);
      font-size: var(--font-size-1);
      padding: 0.5rem;
      display: block;
      text-align: center;
      transition: var(--transition-colors);

      &:hover {
        background: var(--color-gray-8);
      }
    }
  }
</style>
