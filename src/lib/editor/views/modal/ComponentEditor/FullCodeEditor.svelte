<script context="module">
  import { writable } from 'svelte/store'

  const leftPaneSize = writable('33%')
  const centerPaneSize = writable('33%')
  const rightPaneSize = writable('33%')

  const activeTabs = writable({
    html: true,
    css: true,
    js: true,
  })
</script>

<script>
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
  import * as Mousetrap from 'mousetrap'

  import HSplitPane from './HSplitPane.svelte'
  import { CodeMirror } from '../../../components'
  import { onMobile, showKeyHint } from '../../../stores/app/misc'

  export let variants = ''

  export let data = {}

  export let html = ''
  export let css = ''
  export let js = ''

  if (!import.meta.env.SSR) {
    Mousetrap.bind(['mod+1'], () => toggleTab(0))
    Mousetrap.bind(['mod+2'], () => toggleTab(1))
    Mousetrap.bind(['mod+3'], () => toggleTab(2))
  }

  let activeTab = 0

  let selections = {
    html: 0,
    css: 0,
    js: 0,
  }

  function toggleTab(tab) {
    const tabName = {
      0: 'html',
      1: 'css',
      2: 'js',
    }[tab]
    $activeTabs = {
      ...$activeTabs,
      [tabName]: !$activeTabs[tabName],
    }

    const nActive = Object.values($activeTabs).filter(Boolean).length
    if (!nActive) return
    const panelWidth = 100 / nActive
    $leftPaneSize = $activeTabs['html'] ? `${panelWidth}%` : '0'
    $centerPaneSize = $activeTabs['css'] ? `${panelWidth}%` : '0'
    $rightPaneSize = $activeTabs['js'] ? `${panelWidth}%` : '0'
  }

  // close empty tabs
  if (!css && $activeTabs['css']) {
    toggleTab(1)
  }
  if (!js && $activeTabs['js']) {
    toggleTab(2)
  }
</script>

{#if $onMobile}
  <div class="mobile-tabs {variants}">
    <div class="tabs">
      <ul>
        <li class="xyz-in" class:is-active={activeTab === 0}>
          <button on:click={() => (activeTab = 0)}>
            <span>HTML</span>
          </button>
        </li>
        <li class="xyz-in" class:is-active={activeTab === 1}>
          <button on:click={() => (activeTab = 1)}>
            <span>CSS</span>
          </button>
        </li>
        <li class="xyz-in" class:is-active={activeTab === 2}>
          <button on:click={() => (activeTab = 2)}>
            <span>JS</span>
          </button>
        </li>
      </ul>
    </div>
    {#if activeTab === 0}
      <CodeMirror
        mode="html"
        docs="https://docs.primo.so/development#html"
        {data}
        bind:value={html}
        bind:selection={selections['html']}
        on:tab-switch={() => toggleTab(0)}
        on:change={() => dispatch('htmlChange')}
        on:save
        on:refresh
      />
    {:else if activeTab === 1}
      <CodeMirror
        on:tab-switch={() => toggleTab(1)}
        bind:selection={selections['css']}
        bind:value={css}
        mode="css"
        docs="https://docs.primo.so/development#css"
        on:change={() => dispatch('cssChange')}
        on:save
        on:refresh
      />
    {:else}
      <CodeMirror
        on:tab-switch={() => toggleTab(2)}
        bind:selection={selections['js']}
        bind:value={js}
        docs="https://docs.primo.so/development#javascript"
        mode="javascript"
        on:change={() => dispatch('jsChange')}
        on:save
        on:refresh
      />
    {/if}
  </div>
{:else}
  <HSplitPane
    hideLeftOverflow={true}
    bind:leftPaneSize={$leftPaneSize}
    bind:centerPaneSize={$centerPaneSize}
    bind:rightPaneSize={$rightPaneSize}
  >
    <div slot="left" class="tabs">
      <button
        class:tab-hidden={$leftPaneSize <= '0'}
        on:click={() => toggleTab(0)}
      >
        {#if $showKeyHint}
          <span>&#8984; 1</span>
        {:else}
          <span>HTML</span>
        {/if}
      </button>
      <CodeMirror
        mode="html"
        docs="https://docs.primo.so/development#html"
        {data}
        bind:value={html}
        bind:selection={selections['html']}
        on:tab-switch={({ detail }) => toggleTab(detail)}
        on:change={() => dispatch('htmlChange')}
        on:save
        on:refresh
      />
    </div>
    <div slot="center" class="tabs">
      <button
        class:tab-hidden={$centerPaneSize <= '0'}
        on:click={() => toggleTab(1)}
      >
        {#if $showKeyHint}
          <span>&#8984; 2</span>
        {:else}
          <span>CSS</span>
        {/if}
      </button>
      <CodeMirror
        on:tab-switch={({ detail }) => toggleTab(detail)}
        bind:selection={selections['css']}
        bind:value={css}
        mode="css"
        docs="https://docs.primo.so/development#css"
        on:change={() => dispatch('cssChange')}
        on:save
        on:refresh
      />
    </div>
    <div slot="right" class="tabs">
      <button
        class:tab-hidden={$rightPaneSize <= '0'}
        on:click={() => toggleTab(2)}
      >
        {#if $showKeyHint}
          <span>&#8984; 3</span>
        {:else}
          <span>JS</span>
        {/if}
      </button>
      <CodeMirror
        on:tab-switch={({ detail }) => toggleTab(detail)}
        bind:selection={selections['js']}
        bind:value={js}
        mode="javascript"
        docs="https://docs.primo.so/development#javascript"
        on:change={() => dispatch('jsChange')}
        on:save
        on:refresh
      />
    </div>
  </HSplitPane>
{/if}

<style lang="postcss">
  [slot] {
    width: 100%;
  }

  .mobile-tabs {
    display: flex;
    flex-direction: column;
    overflow: scroll;

    ul {
      color: var(--color-gray-2);
      border: 1px solid var(--color-gray-9);
    }
  }

  .tabs {
    height: 100%;
    position: relative;

    button {
      background: var(--color-gray-9);
      color: var(--primo-color-white);
      width: 100%;
      text-align: center;
      padding: 8px 0;
      outline: 0;
      font-size: var(--font-size-1);
      font-weight: 700;
      z-index: 10;

      &.tab-hidden {
        height: 100%;
        position: absolute;
        background: #111;
        transition: background 0.1s, color 0.1s;

        &:hover {
          background: var(--primo-color-brand);
          color: var(--primo-color-codeblack);
        }

        span {
          transform: rotate(270deg);
          display: block;
        }
      }
    }

    ul {
      display: flex;
      justify-content: space-around;

      li {
        flex: 1;
        background: var(--color-gray-9);
        font-size: var(--font-size-1);
        font-weight: 700;
      }
    }
  }

  .tabs ul li:first-child {
    border-top-left-radius: 5px;
  }
  .tabs ul li:last-child {
    border-top-right-radius: 5px;
  }

  .tabs ul li.is-active {
    background: var(--primo-color-codeblack);
    color: var(--primo-color-white);
  }
</style>
