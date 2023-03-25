<script>
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  export let field
  // export let onChange = () => {}

  // export let value = null
  // export let disabled = false
  // export let title = null
  // export let variants = ''

  function selectAll({ target }) {
    if (field.default === field.value) target.select()
  }

  function handleSave({ metaKey, key }) {
    if (metaKey && key === 's') {
      dispatch('save')
    }
  }
</script>

<div>
  <span>{field.label}</span>
  <input
    type="color"
    bind:value={field.value}
    on:input={() => dispatch('input', field)}
  />
</div>

<style lang="postcss">
  div {
    display: flex;
    flex-direction: column;

    span {
      margin-bottom: 0.5rem;
      font-size: var(--label-font-size, 1rem);
      font-weight: var(--label-font-weight, 700);
    }

    input {
      background: transparent;
    }
  }
</style>
