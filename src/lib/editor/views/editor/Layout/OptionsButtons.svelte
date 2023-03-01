<script>
  import { onMount } from 'svelte'
  import { createEventDispatcher, getContext } from 'svelte'
  import modal from '../../../stores/app/modal'
  import { showingIDE, userRole } from '../../../stores/app/misc'

  const dispatch = createEventDispatcher()

  export let deletable = true

  onMount(() => {
    dispatch('mount')
  })

  let element
  $: if (element) {
    // element.scrollIntoView({behavior: "smooth", block: "center", inline: "nearest"})
  }
</script>

<div class="buttons-container primo-reset" bind:this={element}>
  <div class="primo-buttons" class:deletable>
    <button
      class="add-content"
      on:click={() => {
        dispatch('convert', 'content')
      }}
    >
      <i class="fas fa-edit" />
      <span>Add Content</span>
    </button>
    <button
      class="add-component"
      on:click={() => {
        $showingIDE = $userRole === 'developer' // so that 'Create Component' opens up IDE
        modal.show(
          'SYMBOL_LIBRARY',
          {
            onselect: (component) => {
              modal.hide()
              dispatch('select', component)
            },
          },
          {
            hideLocaleSelector: true,
          }
        )
      }}
      on:click={() => dispatch('delete')}
    >
      <i class="fas fa-clone" />
      <span>Add Component</span>
    </button>
    {#if deletable}
      <button
        on:click={() => dispatch('remove')}
        class="delete"
        on:click={() => dispatch('delete')}
      >
        <span>Cancel</span>
      </button>
    {/if}
  </div>
</div>

<style lang="postcss">
  i {
    margin-right: 8px;
  }

  .buttons-container {
    background: var(--primo-color-codeblack);
    border-top: 1px solid var(--primo-color-codeblack);
    border-bottom: 1px solid var(--primo-color-codeblack);

    .primo-buttons {
      padding: 0.5rem 1rem;
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
        border: 0.125rem solid var(--color-gray-8);
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
          border-color: var(--primo-color-brand);
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
