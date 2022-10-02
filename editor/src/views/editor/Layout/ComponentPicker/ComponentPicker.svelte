<script>
  import { fade } from 'svelte/transition';
  import { createEventDispatcher, onMount } from 'svelte';
  import ComponentContainer from '../../../modal/ComponentLibrary/ComponentContainer.svelte';
  import Masonry from './Masonry.svelte';

  import { symbols } from '../../../../stores/data/draft';
  import { createUniqueID } from '../../../../utilities';

  const dispatch = createEventDispatcher();

  function createInstance(symbol) {
    const instanceID = createUniqueID();
    return {
      type: 'component',
      id: instanceID,
      symbolID: symbol.id,
      fields: symbol.fields
    };
  }

  let element;

  onMount(() => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
  });

  let [minColWidth, maxColWidth, gap] = [300, 800, 30];
  let width, height;
</script>

<main in:fade={{ duration: 100 }} bind:this={element} class="primo-reset">
  <div class="primo-buttons">
    <button
      class="close"
      on:click={() => dispatch('remove')}
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
    <button class="primo-button" on:click={() => dispatch('manage')}>
      <i class="fas fa-code" />
      <span>Manage Components</span>
    </button>
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
    <ComponentContainer
      symbol={item}
      buttons={[
        {
          onclick: () => {
            dispatch('select', createInstance(item));
          },
          label: 'Select',
          svg: `<svg style="height:1rem;width:1rem;" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"></path></svg>`,
        },
      ]}
    />
  </Masonry>
</main>

<style lang="postcss">
  main {
    padding: 2.5rem;
    overflow-x: scroll;
    max-height: 75vh;
    background-color: var(--primo-color-codeblack);
  }
  .primo-buttons {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .primo-button {
    background: var(--color-gray-9);
    box-shadow: var(--primo-ring-primogreen);
    padding: 0.5rem 1rem;
    margin-bottom: 1rem;
    border-radius: var(--primo-border-radius);
    color: white;
    font-weight: 600;
    font-size: 0.75rem;
    transition: background 0.1s;
    display: flex;
    align-items: center;

    i {
      margin-right: 0.25rem;
    }

    &:hover {
      background: var(--primo-color-brand);
    }
  }
  button.close {
    transform: translateX(-1rem) translateY(-2rem);
    color: rgba(245, 245, 245, var(--tw-text-opacity));
    height: 2rem;
    width: 2rem;
    color: white;

    &:hover {
      color: var(--primo-color-brand);
    }
  }
</style>
