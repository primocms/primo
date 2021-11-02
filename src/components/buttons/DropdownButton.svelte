<script>
  import { saved } from '../../stores/app/misc';
  import { goto } from '$app/navigation';
  export let button;

  function warn(e) {
    if (!$saved) {
      e.preventDefault()
      window.alert(
        `Save your site before navigating away so you don't lose your changes`
      );
    } else {
      if (button.onClick) button.onClick();
    }
  }
</script>

{#if button.href}
   <a href={button.href} on:click={warn}>
    <i class="{button.icon} mr-1" />
    <span>{button.label}</span>
  </a>
{:else}
  <button on:click={warn} id={button.id}>
    <i class="{button.icon} mr-1" />
    <span>{button.label}</span>
  </button>
{/if}

<style lang="postcss">
  button, a {
    border: 2px solid var(--color-gray-8);
    background: var(--primo-color-codeblack) !important;
    color: var(--color-gray-1) !important;
    font-size: var(--font-size-1) !important;
    display: block !important;
    padding: 0.5rem 1rem !important;
    margin-bottom: 0.5rem !important;
    border-radius: var(--primo-border-radius) !important;
    width: 100% !important;
    text-align: center !important;
    transition: 0.1s box-shadow;
    user-select: none;
    &:not(:last-child) {
      margin-bottom: 0.75rem !important;
    }
    &:hover {
      box-shadow: var(--ring) !important;
    }
  }

  i {
    margin-right: 5px;
  }
</style>
