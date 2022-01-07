<script>
  import Spinner from '$lib/ui/Spinner.svelte'

  export let label = ''
  export let id = null
  export let variants = ''
  export let type = 'button'
  export let disabled = false
  export let loading = false
</script>

{#if type === 'input'}
  <label for="primo-json" class={variants}>
    {#if loading}
      <Spinner />
    {/if}
    <span class:hidden={loading}>
      <slot name="icon" />
    </span>
    <slot name="label" />
    <slot>
      <span class:hidden={loading}>{label}</span>
    </slot>
    <input on:change type="file" id="primo-json" accept=".json" />
  </label>
{:else}
  <button
    on:click
    {id}
    class={variants}
    disabled={disabled || loading}
    {...$$restProps}
    {type}
  >
    {#if loading}
      <Spinner />
    {/if}
    <span class:hidden={loading}>
      <slot name="icon" />
    </span>
    <slot name="label" />
    <slot>
      <span class:hidden={loading}>{label}</span>
    </slot>
  </button>
{/if}

<style lang="postcss">
  button,
  label {
    --Spinner-size: 1rem;

    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    padding: 0.5rem 0;
    border-radius: 0.25rem;
    font-weight: 400;
    font-size: 14px;
    box-shadow: var(--primo-ring-primored);
    color: var(--primo-color-white);
    /* background: var(--primo-color-link); */
    transition: background 0.1s, color 0.1s;
    margin: var(--space-y, 0) var(--space-x, 0);

    &:hover {
      background: var(--primo-color-primored);
    }
    &[disabled] {
      opacity: 0.5;
      pointer-events: none;
    }
  }

  label input {
    display: none;
  }

  .hidden {
    display: none;
  }
</style>
