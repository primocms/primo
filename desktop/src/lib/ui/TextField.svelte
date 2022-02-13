<script>
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  export let value
  export let label = null
  export let prefix = null
  export let variants = ''
  export let button = null
</script>

<!-- svelte-ignore a11y-label-has-associated-control -->
<label class={variants}>
  <slot><span>{label}</span></slot>
  <div>
    {#if prefix}
      <span class="prefix">
        {prefix}
      </span>
    {/if}
    <input
      {...$$restProps}
      bind:value
      on:input
      on:change
      on:focus
      type="text"
    />
    {#if button}
      <button type={button.type}>{button.label}</button>
    {/if}
  </div>
</label>

<style lang="postcss">
  label {
    display: block;
    margin-bottom: 0.5rem;

    & > span {
      color: var(--color-gray-1);
      font-size: 0.875rem;
      line-height: 1.25rem;
      margin-bottom: 0.25rem;
      display: block;
    }

    & > div {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.25rem;
      overflow: hidden;
      background-color: var(--color-gray-8);

      .prefix {
        display: inline-flex;
        align-items: center;
        padding: 0 0.75rem;
        border-top-left-radius: 0.375rem;
        border-bottom-left-radius: 0.375rem;
        border-right-width: 1px;
        border-color: var(--color-gray-7);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      input {
        color: var(--color-gray-1);
        display: block;
        width: 100%;
        background: transparent;
        padding: 0.5rem;
      }

      input::placeholder {
        color: var(--color-gray-6);
      }

      input:focus {
        outline: 0;
      }

      button {
        padding: 0.5rem 1rem;
        background: var(--primo-color-primored);

        &:hover {
        }
      }
    }
  }
  input {
    border: 0;
  }
  input:focus {
    outline: 0;
  }
</style>
