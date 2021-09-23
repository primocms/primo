<script>
  import { onMount } from 'svelte';
  import { findIndex } from 'lodash-es';
  export let buttons = [{ id: 'PLACEHOLDER' }];
  export let selected;

  let element;

  let active = findIndex(buttons, ['id', selected]) || 0;

</script>

<div class="toggle" bind:this={element}>
  {#each buttons as button, i}
    <button
      type="button"
      class:active={active === i}
      on:click={() => {
        active = i;
        selected = button.id;
      }}>{button.label || button.id}</button>
  {/each}
</div>

<style lang="postcss">
  .toggle {
    display: flex;
    flex-wrap: wrap;
    margin-top: 0.25rem;
    border-radius: 0.125rem;
    margin-bottom: var(--SplitButton-mb, 0);

    button {
      flex: 1;
      background: var(--color-gray-7);
      color: var(--color-gray-1);
      padding: 0.5rem;
      font-weight: 500;

      &:focus,
      &.active {
        text-decoration: underline var(--primo-color-primored);
        box-shadow: var(--ring);
        z-index: 1;
      }
    }
  }

</style>
