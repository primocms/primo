<script>
  export let label;
  export let value;
  export let disabled = false;
  export let variants = '';
  export let options;
  export let info = null;
  export let size = 'medium';

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
      <option value={option.id}>{option.label}</option>
    {/each}
  </select>
</label>

<style lang="postcss">
  label {
    display: flex;
    flex-direction: column;

    span {
      margin-bottom: 0.5rem;
      font-size: var(--font-size-2);

      i {
        color: var(--color-gray-3);
        font-size: var(--font-size-1);
      }
    }

    select {
      outline-color: rgb(248, 68, 73);
      background: var(--color-gray-9);
      padding: 0.5rem;
      border: 2px solid var(--color-gray-2);
    }
  }

  label.small {
    font-size: var(--font-size-4);
  }
  label.small span {
    font-size: var(--font-size-1);
    marign-bottom: 0.25rem;
  }
  label.small select {
    padding: 0.25rem 0.5rem;
  }

  label.medium {
    font-size: var(--font-size-3);
  }
  label.medium span {
    font-size: var(--font-size-1);
    margin-bottom: 0.5rme;
  }
  label.medium select {
    padding: 0 0.5rem;
  }

</style>
