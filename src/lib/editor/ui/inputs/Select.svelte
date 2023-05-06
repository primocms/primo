<script>
  /** @type {string | null} */
  export let label = null
  export let value
  export let options
  export let disabled = false
  export let variants = ''
  export let info = null
  export let size = 'medium'
</script>

<label class="{variants} {size}">
  {#if label}
    <span title={info}>
      {label}
      {#if info}<i class="fas fa-info-circle " />{/if}
    </span>
  {/if}

  <select bind:value {disabled} {...$$restProps}>
    {#each options as option}
      {#if option.id === 'DIVIDER'}
        <option disabled>───────</option>
      {:else}
        <option value={option.id}>{option.label}</option>
      {/if}
    {/each}
  </select>
</label>

<style lang="postcss">
  label {
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;

    span {
      margin-bottom: 0.5rem;
      font-size: var(--font-size-2);
      color: #9d9d9d;

      i {
        color: #9d9d9d;
        font-size: var(--font-size-1);
      }
    }

    select {
      height: 100%;
      /* outline-color: var(--primo-color-brand); */
      background: #1f1f1f;
      padding: 0.5rem;
      /* border: 2px solid var(--color-gray-2); */
      border: 1px solid #404040;
      border-radius: var(--primo-border-radius);
      font-size: 1rem;
      color: #cecece;
    }
  }

  label.small {
    font-size: var(--font-size-4);
  }
  label.small span {
    font-size: var(--font-size-1);
    margin-bottom: 0.25rem;
  }
  label.small select {
    padding: 0.25rem 0.5rem;
  }

  label.medium {
    font-size: var(--font-size-3);
  }
  label.medium span {
    font-size: var(--font-size-1);
    margin-bottom: 0.3rem;
  }
  label.medium select {
    padding: 0.4rem 0.5rem;
  }
</style>
