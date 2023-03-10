<script>
  import { createEventDispatcher } from 'svelte'

  export let level = 0
  export let child = false
  export let minimal = false
  export let showDefaultValue = true
  export let showVisibilityOptions = false
  export let top_level = true

  const dispatch = createEventDispatcher()

  function moveItem(direction) {
    dispatch('move', direction)
  }
</script>

<div class="top-container" class:top_level>
  <div
    style="margin-left: {level}rem"
    class="field-container"
    class:has-default-value={showDefaultValue}
    class:has-visibility-options={showVisibilityOptions}
    class:child
    class:minimal
  >
    <label class="type">
      <span>Type</span>
      <slot name="type" />
    </label>
    {#if minimal}
      <slot name="main" />
    {:else}
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <label>
        <span>Label</span>
        <slot name="label" />
      </label>
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <div class="field">
        <label>
          <span>ID</span>
          <slot name="key" />
        </label>
      </div>
      {#if showVisibilityOptions}
        <label class="hide">
          <span>Visible</span>
          <slot name="hide" />
        </label>
      {/if}
    {/if}
    <div class="option-buttons">
      {#if top_level}
        <slot name="toggle" />
      {/if}
      <!-- <button
        disabled={isFirst}
        title="Move up"
        on:click={() => moveItem('up')}
      >
        <Icon icon="mdi:arrow-up" />
      </button>
      <button
        disabled={isLast}
        title="Move down"
        on:click={() => moveItem('down')}
      >
        <Icon icon="mdi:arrow-down" />
      </button> -->
      <!-- <button
        on:click={() => dispatch('delete')}
        {disabled}
        title="delete field"
      >
        <Icon icon="ion:trash" />
      </button> -->
    </div>
  </div>
  <div class="children-container">
    <slot />
  </div>
</div>

<style lang="postcss">
  .top-container {
    &.top_level {
      border: 1px solid #333333;
      border-radius: 6px;
      padding: 20px 24px;
    }
  }

  .field-container {
    display: grid;
    grid-template-columns: auto 1fr 1fr auto;
    gap: 1rem;

    &.has-default-value {
      grid-template-columns: auto 1fr 1fr 1fr auto;
    }

    &.has-visibility-options {
      grid-template-columns: auto 1fr 1fr minmax(4rem, auto) auto;
    }

    &.has-default-value.has-visibility-options {
      grid-template-columns: auto 1fr 1fr 1fr minmax(4rem, auto) auto;
    }

    &.child {
      margin-left: 1rem;
      padding: 0.25rem 0.5rem;
    }

    .type {
      border-radius: 1px;
      display: flex;
      min-width: 3rem;
    }

    label {
      display: flex;
      flex-direction: column;
      flex: 1;

      span {
        font-weight: 600;
        font-size: var(--font-size-1);
        padding-bottom: 2px;
      }
    }

    .option-buttons {
      /* padding: 0.25rem 0.5rem; */
      color: var(--color-gray-3);
      background: var(--color-gray-900);
      z-index: 10;
      border-radius: var(--primo-border-radius);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
      padding-top: 22px;

      button {
        border-radius: 1px;
        transition: color 0.1s;
        &:not(disabled):hover,
        &:not(disabled):focus {
          color: var(--color-gray-4);
        }

        &:last-child {
          color: var(--color-gray-5);
        }
      }
    }

    &.minimal {
      grid-template-columns: auto 1fr auto;
    }
  }
  button[disabled] {
    color: var(--color-gray-7);
    cursor: default;
  }
  span {
    color: var(--color-gray-3);
  }
</style>
