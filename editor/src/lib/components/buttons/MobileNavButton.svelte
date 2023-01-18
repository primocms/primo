<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

</script>

<button on:click={() => dispatch('click')}>
  <svg
    class="fill-current"
    viewBox="0 0 20 20"
    xmlns="http://www.w3.org/2000/svg"><title>Menu</title>
    <path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z" /></svg>
</button>

<style lang="postcss">
  button {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: var(--primo-border-radius);

    svg {
      fill: currentColor;
      height: 0.75rem;
      width: 0.75rem;
    }
  }

</style>
