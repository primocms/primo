<script>
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  export let id = null;
  export let label = null;
  export let prefix = "";
  export let value;
  export let placeholder = "";
  export let variants = "";
  export let autofocus = false;
  export let type = "text";

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
      on:input={({ target }) => {
        value = target.value;
        dispatch("input", value);
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

    span.label {
      margin-bottom: 0.25rem;
      color: var(--color-gray-2);
      font-weight: 600;
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
        background: var(--color-gray-8);
        color: var(--color-gray-1);
        outline-color: var(--primo-color-primored);
        font-weight: 500;
        border-radius: 0.125rem;
        padding: 0.5rem 0.75rem;
        flex: 1;
        border: 0;

        &:focus {
          outline: 0;
        }
      }
    }
  }
</style>
