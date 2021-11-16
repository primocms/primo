<script>
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import ComponentPicker from './ComponentPicker/ComponentPicker.svelte';

  const dispatch = createEventDispatcher();

  export let deletable = true;
  let selectingComponent = false;

  onMount(() => {
    dispatch('mount');
  });

</script>

{#if selectingComponent}
  <ComponentPicker
    on:select={({ detail: component }) => dispatch('select', component)}
    on:manage={() => dispatch('convert', 'symbol')}
    on:remove={() => dispatch('remove')} />
{:else}
  <div class="buttons-container primo-reset">
    <div class="buttons" class:deletable>
      <button
        on:click={() => dispatch('convert', 'content')}
        on:click={() => dispatch('delete')}>
        <i class="fas fa-edit" />
        <span class="hidden md:inline">Add Content</span>
      </button>
      <button
        on:click={() => (selectingComponent = true)}
        on:click={() => dispatch('delete')}>
        <i class="fas fa-clone" />
        <span class="hidden md:inline">Add Component</span>
      </button>
      {#if deletable}
        <button
          on:click={() => dispatch('remove')}
          class="delete"
          on:click={() => dispatch('delete')}>
          <i class="fas fa-trash" />
          <span class="hidden md:inline">Remove</span>
        </button>
      {/if}
    </div>
  </div>
{/if}

<style lang="postcss">
  i {
    margin-right: 8px;
  }

  .buttons-container {
    background: var(--primo-color-codeblack);
    border-top: 1px solid var(--primo-color-codeblack);
    border-bottom: 1px solid var(--primo-color-codeblack);

    .buttons {
      max-width: var(--max-width);
      padding: 0.5rem var(--padding, 1rem);
      margin: 0 auto;
      display: flex;
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;

      &.deletable {
        grid-template-columns: 1fr 1fr auto;
      }

      button {
        background: var(--color-gray-9);
        border: 0.25rem solid var(--color-gray-8);
        color: var(--color-gray-1);
        padding: 1rem 0;
        font-weight: 600;
        flex: 1;
        border-radius: 2px;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 8px;
        font-size: var(--font-size-2);
        transition: var(--transition-colors);

        &:hover {
          border-color: var(--primo-color-primored);
        }

        &.delete {
          padding-left: 20px;
          padding-right: 20px;
        }

        &:focus {
          outline: 0;
        }
      }
    }
  }

</style>
