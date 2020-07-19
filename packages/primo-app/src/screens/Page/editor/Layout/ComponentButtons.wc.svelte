<svelte:options tag={null} />
<script>
  import {code, trash, chevron} from '@svg/small'

  // Workaround to get events firing https://github.com/sveltejs/svelte/issues/3119
  import { createEventDispatcher } from "svelte"
  import { get_current_component } from "svelte/internal"

  const component = get_current_component()
  const svelteDispatch = createEventDispatcher()
  const dispatch = (name, detail) => {
    svelteDispatch(name, detail)
    component.dispatchEvent && component.dispatchEvent(new CustomEvent(name, { detail }))
  }

  export let contentbelow
  export let contentabove

  const iconStyles = `width:13px;margin-right: 5px;position: relative;top: 1px;fill:#f7fafc;`
</script>

<div class="component-buttons">
  <button on:click={() => dispatch('edit')}>
    {@html code(iconStyles)}    
    <span>Edit</span>
  </button>
  <button on:click={() => dispatch('delete')}>
    {@html trash(`${iconStyles} margin-right: 3px;`)}    
    <span>Remove</span>
  </button>
  {#if !contentabove}
    <button on:click={() => dispatch('addContentAbove')}>
      {@html chevron(iconStyles)}    
      <span>Add Content Above</span>
    </button>
  {/if}
  {#if !contentbelow}
    <button on:click={() => dispatch('addContentBelow')}>
      {@html chevron(`${iconStyles}transform: scaleY(-1);top:-3px;`)}    
      <span>Add Content Below</span>
    </button>
  {/if}
</div>

<style>
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  .component-buttons {
    @apply flex flex-wrap;
    margin-bottom: -3px;
    margin-right: -3px;
  }

  button {
    pointer-events: all;
    @apply shadow-lg flex justify-center items-center px-2 h-6 bg-primored text-xs text-gray-100 transition-colors duration-200;
    margin-right: 1px !important;
    margin-bottom: 1px !important;
    outline: none !important;
    &:last-child {
      border-bottom-right-radius: 5px !important;
    }
    &:hover {
      @apply bg-codeblack !important;
    }
  }
</style>