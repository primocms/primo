<script>
  import {fade} from 'svelte/transition'
  import { createEventDispatcher, onMount } from 'svelte'
  import _ from 'lodash'
  import Container from './ComponentPickerContainer.svelte'

  import { symbols } from '../../../../stores/data/draft'
  import { createUniqueID } from '../../../../utilities'

  const dispatch = createEventDispatcher()

  function getID(symbol) {
    return symbol.id + symbol.value.html + symbol.value.css
  }

  function createInstance(symbol) {
    const instanceID = createUniqueID()
    return {
      type: 'component',
      id: instanceID,
      symbolID: symbol.id,
      value: {
        fields: symbol.value.fields
      },
    }
  }

  let mounted = false
  onMount(() => {
    mounted = true
  })

  let element

  onMount(() => {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });
  })

</script>

<main in:fade={{duration:100}} bind:this={element}>
  <div class="flex justify-between items-center">
    <button class="close text-gray-100 hover:text-primored transition-colors duration-100" on:click={() => dispatch('remove')} type="button" xyz="small" aria-label="Close modal">
      <svg class="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
      </svg>
    </button>
    <button class="button" on:click={() => dispatch('manage')}>
      <i class="fas fa-code mr-1"></i>
      <span>Manage Components</span>
    </button>
  </div>
  {#if mounted}
    <ul
      class="grid md:grid-cols-3 lg:grid-cols-4 gap-4 shadow-inner"
      xyz="fade stagger stagger-2"
    >
      {#each $symbols as symbol (getID(symbol))}
        <li class="xyz-in">
          <Container
            titleEditable
            {symbol}
            loadPreview={mounted}
            buttons={[
              { 
                onclick: () => {
                  dispatch('select', createInstance(symbol))
                },
                highlight: true,
                label: 'Select',
                svg: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"></path></svg>`,
              },
            ]}
          />
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  main {
    padding: 2.5rem;
    overflow-x: scroll;
    @apply bg-codeblack border-4 border-primored;
    height: 75vh;
  }
  .button {
    background: rgb(248,68,73);
    padding: 0.5rem 1rem;
    margin-bottom: 1rem;
    border-radius: 0.25rem;
    color: white;
    font-weight: 600;
    font-size: 0.75rem;
    transition: color 0.1s;

    &:hover {
      @apply bg-red-600;
    }
  }
  button.close {
    @apply transform -translate-y-8 -translate-x-4;
  }
</style>
