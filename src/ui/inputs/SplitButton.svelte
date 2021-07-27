<script>
  import { onMount } from 'svelte';
  export let buttons = [{ id: 'PLACEHOLDER' }];
  export let selected;

  let element;

  onMount(() => {
    element.querySelector('button:first-child').focus();
  });

</script>

<div class="toggle" bind:this={element}>
  {#each buttons as button}
    <button
      type="button"
      on:click={() => (selected = button.id)}>{button.label || button.id}</button>
  {/each}
</div>

<style lang="postcss">
  .toggle {
    display: flex;
    margin-top: 0.25rem;
    border-radius: 0.125rem;
    overflow: hidden;

    button {
      flex: 1;
      background: var(--color-gray-7);
      color: var(--color-gray-1);
      padding: 0.5rem 0;
      font-weight: 500;
    }

    button:focus {
      text-decoration: underline var(--color-primored);
      outline-color: var(--color-primored);
    }
  }

</style>
