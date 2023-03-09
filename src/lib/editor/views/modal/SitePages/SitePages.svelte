<script lang="ts">
  import { get, set } from 'idb-keyval'
  import Icon from '@iconify/svelte'
  import PageThumbnails from './PageThumbnails/PageThumbnails.svelte'
  import ModalHeader from '../ModalHeader.svelte'
  import PageList from './PageList/PageList.svelte'
  import { id as siteID } from '../../../stores/data/draft'

  let activeTab = 0

  get(`${$siteID}--page-tab`).then((tab) => {
    if (tab) {
      activeTab = tab
    }
  })
  function set_tab(i) {
    activeTab = i
    set(`${$siteID}--page-tab`, i)
  }
</script>

<ModalHeader icon="fas fa-th-large" title="Pages">
  <div class="buttons">
    <button on:click={() => set_tab(0)} class:active={activeTab === 0}>
      <Icon icon="fa-solid:th-large" />
    </button>
    <button on:click={() => set_tab(1)} class:active={activeTab === 1}>
      <Icon icon="fa-solid:th-list" />
    </button>
  </div>
</ModalHeader>

<main>
  {#if activeTab === 0}
    <PageThumbnails />
  {:else}
    <PageList />
  {/if}
</main>

<style lang="postcss">
  .buttons {
    display: flex;
    gap: 0.5rem;
    padding: 0 1rem;

    button {
      border-radius: 0.25rem;
      transition: 0.1s backgrund;
    }

    button.active {
      padding: 0.5rem;
      background: #252627;
    }
  }
  main {
    padding: 0.5rem 1rem;
    background: var(--primo-color-black);
    overflow-y: scroll;
  }
</style>
