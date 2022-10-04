<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let field;

  if (!field?.options?.options) {
    field.options = {
      options: []
    }
  }

</script>

<div class="label-container">
  <label for={field.key}>
    <span>{field.label}</span>
    {#if field.options.options.length > 0}
      <select bind:value={field.value} on:change={() => dispatch('input')}>
        {#each field.options.options as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    {:else}
      <span>This field doesn't have any options</span>
    {/if}
  </label>
</div>

<style lang="postcss">
  .label-container {
    width: 100%;

    label {
      display: grid;
      gap: 0.75rem;

      span {
        font-weight: var(--label-font-weight, 700);
        font-size: var(--label-font-size, 1rem);
      }

      select {
        border: 1px solid var(--color-gray-8);
        background: transparent;
        border-radius: var(--primo-border-radius);
        padding: 0.25rem 0.5rem;

        &:focus {
          outline: 1px solid var(--primo-color-brand);
        }
      }
    }
  }

</style>
