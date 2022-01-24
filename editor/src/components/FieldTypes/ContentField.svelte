<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let field;
  export let onChange
  
  export let value = null;
  export let disabled = false;
  export let title = null;
  export let variants = '';

</script>


{#if value}
  <label class={variants}>
    <span>{field.label}</span>
    <input class="input" {title} {disabled} type="text" bind:value on:input={({detail}) => {
      onChange()
      dispatch('input', detail)
    }} />
  </label>
{:else}
  <label class={variants}>
    <span>{field.label}</span>
    <input
    class="input"
    {title}
    {disabled}
    type="text"
    bind:value={field.value}
    on:input />
  </label>
{/if}

<style lang="postcss">
  label {
    display: flex;
    flex-direction: column;
    font-size: var(--font-size-4);
    font-weight: 500;

    span {
      margin-bottom: 0.5rem;
      font-size: var(--font-size-2);
    }

    input {
      background: var(--color-gray-8);
      padding: 0.5rem;
      border: 0;

      &:focus {
        outline: 0;
        box-shadow: var(--ring);
      }
    }
  }

</style>
