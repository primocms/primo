<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let field;
  export let onChange = () => {}
  
  export let value = null;
  export let disabled = false;
  export let title = null;
  export let variants = '';

  function selectAll({target}) {
    if (field.default === field.value) target.select()
  }

  function handleSave({ metaKey, key }) {
    if (metaKey && key === 's') {
      dispatch('save')
    }
  }

</script>


{#if value}
  <label class={variants}>
    <span>{field.label}</span>
    <input on:keydown={handleSave} on:focus={selectAll} class="input" {title} {disabled} type="text" bind:value on:input={() => {
      onChange(field)
      dispatch('input', field)
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
    on:keydown={handleSave}
    on:focus={selectAll}
    bind:value={field.value}
    on:input={() => dispatch('input', field)} />
  </label>
{/if}

<style lang="postcss">
  label {
    display: flex;
    flex-direction: column;

    span {
      margin-bottom: 1rem;
      font-size: var(--label-font-size, 1rem);
      font-weight: var(--label-font-weight, 700);
    }

    input {
      background: var(--input-background, #2A2B2D);
      border: var(--input-border, 1px solid #3E4041);
      border-radius: 4px;
      transition: 0.1s border;
      padding: 0.75rem 1rem;
      font-size: 0.875rem;

      &:focus {
        outline: 0;
        border-color: #646668;
      }
    }
  }

</style>
