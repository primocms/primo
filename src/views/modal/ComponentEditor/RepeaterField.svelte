<script>
  import {createEventDispatcher} from 'svelte'
  import {getUniqueId} from '../../../utils.js'
  import {ImageField} from '../../../components/inputs'
  import {fade} from 'svelte/transition'
  const dispatch = createEventDispatcher() 

  export let field
  export let item

  function updateItem(key, val) {
    item[key] = val
    dispatch('input')
  }

</script>

<div class="p-4 mb-2 bg-gray-100 flex flex-col relative transition-colors duration-100" in:fade={{duration:100}}>
  <div class="absolute top-0 right-0 py-1 px-2 text-gray-600 bg-gray-100 z-10 rounded">
    <button title="Move item up" on:click={() => dispatch('move', 'up')}>
      <i class="fas fa-arrow-up"></i>
    </button>
    <button class="mr-2" title="Move item down" on:click={() => dispatch('move', 'down')}>
      <i class="fas fa-arrow-down"></i>
    </button>
    <button class="text-red-500 hover:text-red-700" title="Delete item" on:click={() => dispatch('delete')}>
      <i class="fas fa-trash"></i>
    </button>
  </div>
  {#each field.fields as subfield}
    {#if ['text','number','url'].includes(subfield.type)}
      <slot name="text" {subfield}></slot>
    {:else if subfield.type === 'checkbox'}
      <slot name="checkbox" {subfield}></slot>
    {:else if subfield.type === 'content'}
      <slot name="content" {subfield}></slot>
    {:else if subfield.type === 'image'}
      <slot name="image" {subfield}></slot>
    {/if}
  {/each}
</div>