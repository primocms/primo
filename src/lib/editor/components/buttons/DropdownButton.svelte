<script>
  export let button

  function click(e) {
    if (button.onClick) button.onClick(e)
  }
</script>

{#if button.href}
  <a href={button.href} on:click={click}>
    <i class={button.icon} />
    <span>{button.label}</span>
  </a>
{:else}
  <button on:click={button.onClick} id={button.id}>
    <i class={button.icon} />
    <span>{button.label}</span>
  </button>
{/if}

<style lang="postcss">
  button,
  a {
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
