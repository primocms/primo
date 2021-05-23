<script>
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  import { CodeMirror } from "../../../components";
  export let disabled = false;

  export let variants = "";

  export let html = "";
  export let css = "";
  export let js = "";

  let activeTab = 0;

  let selections = {
    html: 0,
    css: 0,
    js: 0
  }

</script>

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

<style>
  .tabs {
    /* height: 35px; */
  }

  .tabs ul {
    @apply flex justify-around;
  }

  .tabs ul li {
    @apply flex-1 border-gray-900 text-xs font-bold;
  }

  .tabs ul li button {
    @apply w-full text-center py-2 outline-none text-xs font-bold;

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