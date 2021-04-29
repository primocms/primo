<script>
  import { fade } from 'svelte/transition'
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  export let tabs
  export let activeTab
  export let variants = ''
  export let activeColor = 'rgb(248,68,73)'

  $: dispatch('switch', activeTab)
</script>

{#if tabs.length > 1}
  <div class="tabs {variants}" in:fade={{ duration: 200 }}>
    <ul xyz="fade stagger">
      {#each tabs as tab}
        <li
          class="xyz-in border-b-2 border-transparent"
          class:is-active={activeTab === tab}
        >
          <button
            on:click={() => (activeTab = tab)}
            id={tab.id ? `tab-${tab.id}` : null}
          >
            {#if tab.icon}<i class="fas fa-{tab.icon}" />{/if}
            {typeof tab === 'string' ? tab : tab.label}
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .tabs {
    @apply text-gray-300;
  }
  .tabs:not(.secondary) {
    min-height: 2.5rem;
    @apply border border-gray-800 mb-1;
  }
  .tabs:not(.secondary) ul {
    @apply flex justify-around;
  }
  .tabs:not(.secondary) li {
    @apply flex-1 border-b-2 border-transparent;
    &.is-active {
      @apply border-primored;
    }
  }

  .tabs:not(.secondary) li button {
    @apply block w-full text-center py-2 outline-none font-medium;
  }

  .tabs:not(.secondary) li button i {
    @apply mr-2;
  }

  .tabs.secondary {
    height: 35px;
  }

  .tabs.secondary ul {
    @apply flex justify-around;
  }

  .tabs.secondary li {
    @apply flex-1 border-transparent text-xs font-bold;
  }

  .tabs.secondary li button {
    @apply w-full text-center py-2 outline-none text-xs font-bold;
  }

  .tabs.secondary li.is-active {
    @apply bg-codeblack text-white;
    @apply border-codeblack;
  }

</style>
