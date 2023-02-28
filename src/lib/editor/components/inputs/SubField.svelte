<script>
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import { IconButton } from '../misc';

  export let disabled = false;

  const dispatch = createEventDispatcher();

</script>

<div class="subfield">
  <div class="select">
    <slot name="type" />
  </div>
  <div class="input-group">
    <span>Label</span>
    <div>
      <slot name="label" />
    </div>
  </div>
  <div class="input-group">
    <span>ID</span>
    <div>
      <slot name="key" />
    </div>
  </div>
  <IconButton
    icon="times"
    variants="is-danger is-outlined"
    on:click={() => dispatch('delete')}
    {disabled} />
</div>

<style lang="postcss">
  .subfield {
    display: flex;
    width: 100%;
    padding: 0.5rem 0.75rem;
    align-items: center;
    font-size: var(--font-size-2);

    .select {
      margin-right: 0.5rem;
    }

    .input-group {
      display: flex;
      align-items: center;
      flex: 1;

      span {
        padding: 0.5rem;
        font-weight: 600;
      }

      div {
        margin-right: 1rem;
        flex: 1;
        display: flex;
      }
    }
  }

  :global(.input-group > div input) {
    flex: 1;
    outline: 0;
    border-bottom: 1px solid rgb(229, 229, 229);
    transition: border-color 0.2s;
  }
  :global(.input-group > div input:focus) {
    border-color: var(----primo-color-brand);
  }

</style>
