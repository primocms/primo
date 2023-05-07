<script>
  import { fade } from 'svelte/transition'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  export let preview
  export let title
  export let selected = false
</script>

<button
  class="theme-thumbnail"
  class:selected
  type="button"
  in:fade={{ duration: 100 }}
  on:click={() => {
    selected = true
    dispatch('click')
  }}
>
  <img src={preview} alt={title} />
  {#if title}
    <div class="title">{title}</div>
  {/if}
</button>

<style lang="postcss">
  .theme-thumbnail {
    border-radius: var(--primo-border-radius);
    background: var(--color-gray-8);
    overflow: hidden;
    transition: 0.1s box-shadow;

    &.selected {
      box-shadow: 0px 0px 0px 2px var(--primo-color-brand);
    }

    &:hover {
      opacity: 0.75;
    }
  }
  .title {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.5rem 0.75rem;
    text-align: left;
    border-top: 1px solid var(--color-gray-9);
  }
</style>
