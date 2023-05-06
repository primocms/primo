<script>
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  /** @type {string | null} */
  export let id = null

  /** @type {string | null} */
  export let label = null

  /** @type {string} */
  export let prefix = ''

  /** @type {string} */
  export let value
  export let placeholder = ''
  export let variants = ''
  export let type = 'text'
  export let autofocus = false

  // Note: Svelte seems to have some issues with two-way binding, so if this is acting up it's probably that
</script>

<!-- svelte-ignore a11y-label-has-associated-control -->
<label class={variants} {id}>
  {#if label}<span class="label">{label}</span>{/if}
  <div class="input-container">
    {#if prefix}<span class="prefix">{prefix}</span>{/if}
    <input
      {value}
      {type}
      {placeholder}
      {autofocus}
      on:input={({ target }) => {
        value = target.value
        dispatch('input', value)
      }}
    />
  </div>
</label>

<style lang="postcss">
  label {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    color: var(--color-gray-2);
    margin-top: var(--TextInput-mt, 0);
    margin-bottom: var(--TextInput-mb, 0);
    margin-right: var(--TextInput-mr, 0);
    margin-left: var(--TextInput-ml, 0);
    width: 100%;

    span.label {
      font-size: var(--TextInput-label-font-size, 0.875rem);
      margin-bottom: 0.25rem;
      color: #9d9d9d;
      font-weight: 400;
    }

    .input-container {
      display: flex;
      align-items: normal;
      width: 100%;

      span.prefix {
        display: flex;
        align-items: center;
        margin-right: 1rem;
      }
      input {
        display: block;
        width: 100%;
        background: #1f1f1f;
        border: 1px solid #404040;
        color: #cecece;
        font-weight: 400;
        border-radius: var(--input-border-radius);
        padding: 0.3rem 0.75rem;
        flex: 1;
        transition: 0.1s border;

        &:focus {
          outline: 0;
          border-color: var(--primo-color-brand);
        }

        &::placeholder {
          color: #797979;
        }
      }
    }
  }
</style>
