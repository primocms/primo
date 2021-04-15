<script>
  export let button

  let variants = button.variants || 'bg-codeblack text-gray-100 hover:bg-primored'
</script>

{#if button.href}
  <a class="dropdown-button {variants}" href={button.href} id={button.id}>
    <i class="{button.icon} mr-1"></i>
    <span>{button.label}</span>
  </a>
{:else}
  <button class="block px-4 py-2 rounded transition-colors duration-100 w-full text-xs text-center {variants}" id={button.id} on:click={button.onClick}>
    <i class="{button.icon} mr-1"></i>
    <span>{button.label}</span>
  </button>
{/if}

<style>
  .dropdown-button {
    @apply block px-4 py-2 mb-2 rounded transition-colors duration-100 w-full text-xs text-center;
    &:not(:last-child) {
      @apply mb-3;
    }
  }
</style>