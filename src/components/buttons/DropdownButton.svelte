<script>
  export let button;

</script>

{#if button.href}
  <a href={button.href} id={button.id}>
    <i class="{button.icon} mr-1" />
    <span>{button.label}</span>
  </a>
{:else}
  <button id={button.id} on:click={button.onClick}>
    <i class="{button.icon} mr-1" />
    <span>{button.label}</span>
  </button>
{/if}

<style lang="postcss">
  a,
  button {
    background: var(--color-codeblack);
    box-shadow: var(--ring);
    color: var(--color-gray-1);
    font-size: var(--font-size-1);
    display: block;
    padding: 0.5rem 1rem;
    margin-bottom: 0.5rem;
    border-radius: var(--border-radius-1);
    width: 100%;
    text-align: center;
    &:not(:last-child) {
      margin-bottom: 0.75rem;
    }
    &:hover {
      background: var(--color-primored);
    }
  }

  i {
    margin-right: 5px;
  }

</style>
