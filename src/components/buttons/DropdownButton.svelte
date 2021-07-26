<script>
  export let button;

  let variants =
    button.variants || 'bg-codeblack text-gray-100 hover:bg-primored';

</script>

{#if button.href}
  <a class="dropdown-button {variants}" href={button.href} id={button.id}>
    <i class="{button.icon} mr-1" />
    <span>{button.label}</span>
  </a>
{:else}
  <button
    class="block px-4 py-2 rounded transition-colors duration-100 w-full text-xs text-center {variants}"
    id={button.id}
    on:click={button.onClick}>
    <i class="{button.icon} mr-1" />
    <span>{button.label}</span>
  </button>
{/if}

<style lang="postcss">
  .dropdown-button {
    display: block;
    padding: 0.5rem 1rem;
    margin-bottom: 0.5rem;
    border-radius: var(--border-radius-1);
    width: 100%;
    font-size: var(--font-size-1);
    text-align: center;
    &:not(:last-child) {
      margin-bottom: 0.75rem;
    }
  }

</style>
