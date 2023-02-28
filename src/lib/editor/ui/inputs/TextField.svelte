<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let label;
  export let value;
  export let type = 'text';
  export let disabled = false;
  export let variants = '';
  export let size = 'medium';

  function onInput({ target }) {
    const { value: inputValue } = target;
    if (['text', 'number', 'range', 'password', 'url'].includes(type)) {
      value = inputValue;
    } else {
      console.log('Value not saved:', inputValue);
    }
    dispatch('input');
  }

</script>

<!-- svelte-ignore a11y-label-has-associated-control -->
<label class="{size} {variants}">
  {#if label}<span>{label}</span>{/if}
  <input
    class="input"
    {value}
    {type}
    {disabled}
    {...$$restProps}
    on:input={onInput} />
  <slot />
</label>

<style lang="postcss">
  label {
    display: flex;
    flex-direction: column;
    font-weight: 500;
  }

  label.small {
    font-size: 1.125rem /* 18px */;
    line-height: 1.75rem /* 28px */;
  }
  label.small span {
    margin-bottom: 0.25rem;
    font-size: 0.75rem /* 12px */;
    line-height: 1rem /* 16px */;
  }
  label.small input {
    padding: 0.25rem 0.5rem;
  }

  label.medium {
    font-size: 1.25rem /* 20px */;
    line-height: 1.75rem /* 28px */;
  }
  label.medium span {
    margin-bottom: 0.25rem;
    font-size: 0.875rem /* 14px */;
    line-height: 1.25rem /* 20px */;
  }
  label.medium input {
    padding: 0.5rem;
  }

  input {
    outline-color: var(--primo-color-brand);
    background-color: rgb(38, 38, 38);
    border-bottom: 2px solid rgb(23, 23, 23);
    padding: 0.25rem 0.5rem;
  }

</style>
