<script>
  import { fade } from 'svelte/transition';
  import { createEventDispatcher, onMount } from 'svelte';
  import _ from 'lodash';
  import SymbolContainer from '../../../modal/SymbolLibrary/SymbolContainer.svelte';

  import { symbols } from '../../../../stores/data/draft';
  import { createUniqueID } from '../../../../utilities';

  const dispatch = createEventDispatcher();

  const componentID = (component) =>
    component.id + component.value.html + component.value.css;

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

  let mounted = false;
  onMount(() => {
    mounted = true;
  });

  let element;

  onMount(() => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center',
    });
  });

</script>

<main in:fade={{ duration: 100 }} bind:this={element}>
  <div class="buttons">
    <button
      class="close"
      on:click={() => dispatch('remove')}
      type="button"
      xyz="small"
      aria-label="Close modal">
      <svg stroke="currentColor" fill="none" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
    <button class="button" on:click={() => dispatch('manage')}>
      <i class="fas fa-code" />
      <span>Manage Components</span>
    </button>
  </div>
  {#if mounted}
    <ul class="components" xyz="fade stagger stagger-2">
      {#each $symbols as symbol (componentID(symbol))}
        <li class="xyz-in">
          <SymbolContainer
            {symbol}
            buttons={[{ onclick: () => {
                  dispatch('select', createInstance(symbol));
                }, highlight: true, label: 'Select', svg: `<svg style="height:1rem;width:1rem;" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"></path></svg>` }]} />
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  main {
    padding: 2.5rem;
    overflow-x: scroll;
    height: 75vh;
    background-color: rgba(30, 30, 30);
    border-width: 4px;
    border-color: rgba(248, 68, 73);
  }
  .buttons {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .button {
    background: rgb(248, 68, 73);
    padding: 0.5rem 1rem;
    margin-bottom: 1rem;
    border-radius: 0.25rem;
    color: white;
    font-weight: 600;
    font-size: 0.75rem;
    transition: color 0.1s;

    i {
      margin-right: 0.25rem;
    }

    &:hover {
      background-color: rgba(220, 38, 38, var(--tw-bg-opacity));
    }
  }
  button.close {
    transform: translateX(-1rem) translateY(-2rem);
    color: rgba(245, 245, 245, var(--tw-text-opacity));
    height: 2rem;
    width: 2rem;
    color: white;

    &:hover {
      color: var(--color-primored);
    }
  }

  .components {
    display: grid;
    gap: 1rem;
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000),
      var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
  }

  @media (min-width: 768px) {
    .components {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (min-width: 1024px) {
    .components {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

</style>
