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
    <div>
      <div class="plus">
        <svg
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"><path
            fill-rule="evenodd"
            d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
            clip-rule="evenodd" /></svg>
      </div>
      <div class="buttons" class:deletable>
        <button
          on:click={() => dispatch('convert', 'content')}
          on:click={() => dispatch('delete')}>
          <i class="fas fa-edit" />
          <span class="hidden md:inline">Content</span>
        </button>
        <button
          on:click={() => (selectingComponent = true)}
          on:click={() => dispatch('delete')}>
          <i class="fas fa-clone" />
          <span class="hidden md:inline">Component</span>
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
  </div>
{/if}

<style lang="postcss">
  i {
    margin-right: 8px;
  }

  .buttons-container {
    background: var(--primo-color-black);
    border-top: 1px solid var(--primo-color-codeblack);
    border-bottom: 1px solid var(--primo-color-codeblack);

    & > div {
      max-width: var(--max-width-container);
      margin: 0 auto;
      padding: 10px var(--padding-container);
      display: flex;

      .plus {
        color: var(--color-gray-2);
        width: 30px;
        display: flex;
        align-items: center;
        margin-right: 0.5rem;
      }

      .buttons {
        flex: 1;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;

        &.deletable {
          grid-template-columns: 1fr 1fr auto;
        }

        button {
          background: var(--color-gray-9);
          box-shadow: var(--primo-ring-primored);
          color: var(--color-gray-1);
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
            background: var(--primo-color-primored);
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
  }

</style>
