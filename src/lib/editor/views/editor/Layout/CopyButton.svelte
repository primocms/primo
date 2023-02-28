<script>
  export let icon;
  export let active = false;

</script>

<button on:click class:active>
  <i class="fas fa-{icon}" />
  <!-- <span class="opacity-0">></span> -->
</button>

<style lang="postcss">
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.75rem;
    transition: var(--transition-colors);

    i {
      opacity: 1;
      transition: opacity 0.1s;
    }

    &:hover {
      background: var(--primo-color-brand);
      color: var(--color-gray-1);
    }

    &.active {
      background: var(--primo-color-brand);
      color: var(--primo-color-white);
    }
  }

</style>
