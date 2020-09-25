<script lang="ts">
  
  type button = {
    label: string,
    icon: string,
    onClick?: () => void,
    id?: string,
    variants?: string,
    href?: string
  }

  export let button:button

  let variants = button.variants || 'bg-red-500 text-red-100 hover:bg-red-600'
</script>

{#if button.href}
  <a class="dropdown-button {variants}" href={button.href} id={button.id}>
    <i class="{button.icon} mr-1"></i>
    <span>{button.label}</span>
  </a>
{:else}
  <button class="dropdown-button {variants}" id={button.id} on:click={button.onClick}>
    <i class="{button.icon} mr-1"></i>
    <span>{button.label}</span>
  </button>
{/if}

<style>
  .dropdown-button {
    @apply block px-4 py-2 rounded transition-colors duration-100 w-full text-xs text-center;
    &:not(:last-child) {
      @apply mb-3;
    }
  }
</style>