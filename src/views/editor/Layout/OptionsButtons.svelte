<script>
  import { createEventDispatcher } from 'svelte';
  import ComponentPicker from './ComponentPicker/ComponentPicker.svelte';

  const dispatch = createEventDispatcher();

  export let deletable = true;
  let selectingComponent = false;

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
          class="is-primored"
          on:click={() => dispatch('delete')}>
          <i class="fas fa-edit" />
          <span class="hidden md:inline">Content</span>
        </button>
        <button
          on:click={() => (selectingComponent = true)}
          class="is-primored"
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
    background: var(--color-black);
    border-top: 1px solid var(--color-codeblack);
    border-bottom: 1px solid var(--color-codeblack);

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
          background-color: var(--color-gray-8);
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

          &.is-primored {
            background: var(--color-primored);

            &:hover {
              background: var(--color-primored-dark);
            }
          }

          &.delete {
            padding-left: 20px;
            padding-right: 20px;
            border: 1px solid var(--color-gray-8);

            &:hover {
              background: var(--color-primored-dark);
            }
          }

          &:focus {
            outline: 0;
          }
        }
      }
    }
  }

</style>
