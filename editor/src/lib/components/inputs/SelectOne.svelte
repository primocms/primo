<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let id = null;
  export let label;
  export let options;
  export let selection;
  export let variants = '';

  $: dispatch('select', selection);

</script>

<div class={variants} {id}>
  <span>{label}</span>
  <div class="toggle">
    {#each options as option}
      <button
        class:selected={selection === option}
        type="button"
        on:click={() => (selection = option)}>{option}</button>
    {/each}
  </div>
</div>

<style lang="postcss">
  span {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .toggle {
    display: flex;
    margin-top: 0.25rem;
    border-radius: 1px;
    overflow: hidden;

    button {
      flex: 1;
      background: var(--color-gray-1);
      color: var(--color-gray-7);
      padding: 0.5rem 0;
      transition: background 0.1s, color 0.1s;

      &.selected {
        background: var(--primo-color-brand);
        color: var(--color-gray-1);
        outline: 0;
      }
    }
  }

</style>
