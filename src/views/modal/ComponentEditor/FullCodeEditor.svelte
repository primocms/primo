<script>
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  import HSplitPane from './HSplitPane.svelte';
  import { CodeMirror } from "../../../components";
  import { onMobile } from "../../../stores/app/misc";

  export let disabled = false;

  export let variants = "";

  export let html = "";
  export let css = "";
  export let js = "";

  let activeTab = 0
  const activeTabs = {
    html: true,
    css: true,
    js: true
  };

  let selections = {
    html: 0,
    css: 0,
    js: 0
  }
  
  let resetSize

  function toggleTab(tab) {
    const tabName = {
      0: 'html',
      1: 'css',
      2: 'js'
    }[tab]
    activeTabs[tabName] = !activeTabs[tabName]

    if (activeTabs.html && activeTabs.css && activeTabs.js) {
      leftPaneSize = '33%'
      centerPaneSize = '33%'
      rightPaneSize = '33%'
    } else if (!activeTabs.html && activeTabs.css && activeTabs.js) {
      leftPaneSize = '0'
      centerPaneSize = '66%'
      rightPaneSize = '66%'
    } else if (!activeTabs.html && activeTabs.css && !activeTabs.js) {
      leftPaneSize = '0'
      centerPaneSize = '100%'
      rightPaneSize = '0'
    } else if (!activeTabs.html && !activeTabs.css && activeTabs.js) {
      leftPaneSize = '0'
      centerPaneSize = '0'
      rightPaneSize = '100%'
    } else if (activeTabs.html && !activeTabs.css && !activeTabs.js) {
      leftPaneSize = '100%'
      centerPaneSize = '0'
      rightPaneSize = '0'
    } else if (activeTabs.html && activeTabs.css && !activeTabs.js) {
      leftPaneSize = '50%'
      centerPaneSize = '50%'
      rightPaneSize = '0'
    } else if (activeTabs.html && !activeTabs.css && activeTabs.js) {
      leftPaneSize = '50%'
      centerPaneSize = '0'
      rightPaneSize = '50%'
    } 
    localStorage.setItem(`pane-html`, leftPaneSize)
    localStorage.setItem(`pane-css`, centerPaneSize)
    localStorage.setItem(`pane-js`, rightPaneSize)

    resetSize()
  }

  let leftPaneSize = localStorage.getItem('pane-html') || '33%'
  let centerPaneSize = localStorage.getItem('pane-css') || '33%'
  let rightPaneSize = localStorage.getItem('pane-js') || '33%'

</script>

{#if $onMobile}
  <div class="flex flex-col overflow-scroll {variants}">
    <div class="tabs is-toggle is-fullwidth is-small">
      <ul class="text-gray-200 border border-gray-900" xyz="fade stagger delay-2">
        <li class="xyz-in" class:is-active={activeTab === 0}>
          <button on:click={() => (activeTab = 0)}>
            <span>HTML</span>
          </button>
        </li>
        <li class="xyz-in border-l border-r border-gray-900" class:is-active={activeTab === 1}>
          <button on:click={() => (activeTab = 1)}> <span>CSS</span> </button>
        </li>
        <li class="xyz-in" class:is-active={activeTab === 2}>
          <button on:click={() => (activeTab = 2)}> <span>JS</span> </button>
        </li>
      </ul>
    </div>
    {#if activeTab === 0}
      <CodeMirror
        autofocus
        mode="html"
        {disabled}
        bind:value={html}
        bind:selection={selections['html']}
        on:tab-switch={({detail}) => activeTab = detail}
        on:change={({ detail }) => dispatch('htmlChange')}
        on:save={() => dispatch('save')}
        docs="https://handlebarsjs.com/guide/" />
    {:else if activeTab === 1}
      <CodeMirror
        autofocus
        on:tab-switch={({detail}) => activeTab = detail}
        bind:selection={selections['css']}
        bind:value={css}
        mode="css"
        {disabled}
        on:change={({ detail }) => dispatch('cssChange')}
        on:save={() => dispatch('save')} />
    {:else}
      <CodeMirror
        autofocus
        on:tab-switch={({detail}) => activeTab = detail}
        bind:selection={selections['js']}
        bind:value={js}
        mode="javascript"
        {disabled}
        on:change={({ detail }) => dispatch('jsChange')}
        on:save={() => dispatch('save')} />
    {/if}
  </div>
{:else}
  <HSplitPane {leftPaneSize} {centerPaneSize} {rightPaneSize} bind:resetSize>
    <div slot="left" class="tabs">
      <button class:tab-hidden={leftPaneSize === '0'} on:click={() => toggleTab(0)}>
        <span>HTML</span>
      </button>
      <CodeMirror
        autofocus
        mode="html"
        {disabled}
        bind:value={html}
        bind:selection={selections['html']}
        on:tab-switch={({detail}) => toggleTab(detail)}
        on:change={() => dispatch('htmlChange')}
        on:save
        docs="https://handlebarsjs.com/guide/" />
    </div>
    <div slot="center" class="tabs">
      <button class:tab-hidden={centerPaneSize === '0'} on:click={() => toggleTab(1)}>
        <span>CSS</span>
      </button>
      <CodeMirror
        autofocus
        on:tab-switch={({detail}) => toggleTab(detail)}
        bind:selection={selections['css']}
        bind:value={css}
        mode="css"
        {disabled}
        on:change={() => dispatch('cssChange')}
        on:save />
    </div>
    <div slot="right" class="tabs">
      <button class:tab-hidden={rightPaneSize === '0'} on:click={() => toggleTab(2)}>
        <span>JS</span>
      </button>
      <CodeMirror
        autofocus
        on:tab-switch={({detail}) => toggleTab(detail)}
        bind:selection={selections['js']}
        bind:value={js}
        mode="javascript"
        {disabled}
        on:change={() => dispatch('jsChange')}
        on:save />
    </div>
  </HSplitPane>
{/if}


<style>
  [slot] {
    width: 100%;
  }

  .tabs ul {
    @apply flex justify-around;
  }

  .tabs ul li {
    @apply flex-1 border-gray-900 text-xs font-bold;
  }

  .tabs button {
    @apply text-white w-full text-center py-2 outline-none text-xs font-bold z-10;

    &.tab-hidden {
      height: 100%;
      position: absolute;
      background: #111;
      transition: background 0.1s 0.05s;

      &:hover {
        background: rgb(248,68,73);
      }

      span {
        transform: rotate(270deg);
        display: block;
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
    @apply bg-codeblack text-white;
  }

</style>