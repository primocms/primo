<script>
  import { fade } from 'svelte/transition';
  import SymbolContainer from './SymbolLibrary/SymbolContainer.svelte';
  import Masonry from '../editor/Layout/ComponentPicker/Masonry.svelte';

  import { symbols } from '../../stores/data/draft';
  import { createUniqueID } from '../../utilities';
  import modal from '../../stores/app/modal'

  export let onselect

  function createInstance(symbol) {
    const instanceID = createUniqueID();
    return {
      type: 'component',
      id: instanceID,
      symbolID: symbol.id,
      value: {
        fields: symbol.value.fields,
      },
    };
  }

  let [minColWidth, maxColWidth, gap] = [300, 800, 30];
  let width, height;
</script>

<main in:fade={{ duration: 100 }} class="primo-reset">
  <div class="buttons">
    <button
      class="close"
      on:click={modal.hide}
      type="button"
      xyz="small"
      aria-label="Close modal"
    >
      <svg stroke="currentColor" fill="none" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </button>
    {#if $symbols.length > 0}
      <button id="add-manage" on:click={() => {
        modal.show('SYMBOL_LIBRARY');
      }}>
        <i class="fas fa-clone" />
        <span>Component Library</span>
      </button>
    {/if}
  </div>
  <Masonry
    items={$symbols}
    {minColWidth}
    {maxColWidth}
    {gap}
    masonryWidth={10}
    animate={false}
    let:item
    bind:width
    bind:height
  >
    <SymbolContainer
      symbol={item}
      buttons={[
        {
          onclick: () => {
            onselect(createInstance(item));
          },
          label: 'Add to Page',
          svg: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                </svg>`,
        },
      ]}
    />
  </Masonry>
  {#if $symbols.length === 0}
    <div id="empty-state">
      <span>
        This is where you select Components to add them to the page.<br> You don't have any components in your Site Library yet
      </span>
      <button id="add-manage" on:click={() => {
        modal.show('SYMBOL_LIBRARY');
      }}>
        <i class="fas fa-clone" />
        <span>Add Components</span>
      </button>
    </div>
  {/if}
</main>

<style lang="postcss">
  main {
    padding: 2.5rem;
    overflow-x: scroll;
    background-color: var(--primo-color-codeblack);
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .buttons {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  button#add-manage {
    background: var(--color-gray-9);
    padding: 0.75rem 1.5rem;
    margin-bottom: 1rem;
    border-radius: var(--primo-border-radius);
    color: var(--primo-color-white);
    transition: background 0.1s;
    display: flex;
    align-items: center;
    font-weight: 600;

    i {
      margin-right: 0.5rem;
    }

    &:hover {
      background: transparent;
    }
  }
  button.close {
    transform: translateX(-1rem) translateY(-2rem);
    color: rgba(245, 245, 245, var(--tw-text-opacity));
    height: 2rem;
    width: 2rem;
    color: white;

    &:hover {
      color: var(--primo-color-primored);
    }
  }

  #empty-state {
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    gap: 1rem;
    color: var(--primo-color-white);
    text-align: center;
  }

</style>
