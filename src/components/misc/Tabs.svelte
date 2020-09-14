<script lang="ts">
  import {fade} from 'svelte/transition'

  import type {Tab,Tabs} from '../../types/components'

  export let tabs:Tabs
  export let activeTab:Tab
  export let variants:string = ''
  export let activeColor:string = 'rgb(30,30,30)'

  const tabStyles = (active:boolean): string => active ? `border-color:${activeColor};color:${activeColor};` : `border-color:transparent;`
</script>

{#if tabs.length > 1}
  <div class="tabs {variants}" in:fade={{ duration: 200 }}>
    <ul>
      {#each tabs as tab}
        <li style={!variants.includes('secondary') ? tabStyles(activeTab === tab) : ''} class:is-active={activeTab === tab}>
          <button on:click={() => activeTab = tab} id={ tab.id ? `tab-${tab.id}` : null}>
            {#if tab.icon}<i class="fas fa-{tab.icon}"></i>{/if}
            { typeof tab === 'string' ? tab : tab.label }
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}


<style>
  .tabs:not(.secondary) {
    min-height: 2.5rem;
    outline: 1px solid #eee;
    ul {
      @apply flex justify-around;
    }
    li {
      @apply flex-1;
      border-bottom-width: 3px;
      border-bottom-style: solid;
      border-color: transparent;

      /* border-top: 1px solid #eee !important; */

      &:not(:last-child) {
        border-right: 1px solid #eee !important;
      }

      /* &:first-child {
        border-left: 1px solid #eee !important;
      } */

      button {
        @apply block w-full text-center py-2 outline-none font-medium;

        i {
          @apply mr-2;
        }
      }

    }
  }

  .tabs.secondary {
    height: 35px;

    ul {
      @apply flex justify-around;

      li {
        @apply flex-1 border-transparent text-xs font-bold;
        border-top: 1px solid #eee;

        button {
          @apply w-full text-center py-2 outline-none text-xs font-bold;

          /* i {
            @apply mr-2;
          } */
        }

        &.is-active {
          @apply bg-primored text-white;
        }

        &:first-child {
          border-top-left-radius: 5px;
          border-left: 1px solid #eee;
          border-right: 1px solid #eee;
        }
        &:last-child {
          border-top-right-radius: 5px;
          border-left: 1px solid #eee;
          border-right: 1px solid #eee;
        }
      }
    }
  }
</style>