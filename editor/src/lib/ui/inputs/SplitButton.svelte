<script>
  import Icon from '@iconify/svelte';
  import { findIndex } from 'lodash-es';
  export let buttons = [{ id: 'PLACEHOLDER' }];
  export let selected;

  let element;

  let active = findIndex(buttons, ['id', selected]) || 0;

</script>

<div class="toggle" bind:this={element}>
  {#each buttons as button, i}
    <button
      type="button"
      class:active={active === i}
      on:click={() => {
        active = i;
        selected = button.id;
      }}>
        {#if button.icon}
          <Icon icon={button.icon} width="14px" />
        {/if} 
        <span>{button.label || button.id}</span>
      </button>
  {/each}
</div>

<style lang="postcss">
  .toggle {
    display: flex;
    flex-wrap: wrap;
    margin-top: 0.25rem;
    border-radius: var(--input-border-radius);
    margin-bottom: var(--SplitButton-mb, 0);

    background: var(--input-background, #58595B);
    padding: 0.25rem;
    border-radius: 2rem;

    button {
      border-radius: 1rem;
      font-size: 0.875rem;
      
      flex: 1;
      background: var(--color-gray-7);
      color: #8A8C8E;
      padding: 0.5rem 2rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;

      background: transparent;

      &:focus,
      &.active {
        color: white;
        background: #3E4041;
        z-index: 1;
      }
    }
  }

</style>
