<script>
  import {createEventDispatcher} from 'svelte'
  import SiteThumbnail from './SiteThumbnail.svelte'

  const dispatch = createEventDispatcher()

  export let site
  export let preview
  export let title
  export let selected = false

</script>


<button class="theme-thumbnail" class:selected type="button" on:click={() => {
  selected = !selected
  dispatch('click')
}}>
  <SiteThumbnail {site} {preview} />
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
      box-shadow: 0px 0px 0px 3px #F27473;
    }

    &:hover {
      opacity: 0.75;
    }
  }
  .title {
    font-size: 0.75rem;
    font-weight: 500;
    padding: 0.75rem;
    text-align: left;
    border-top: 1px solid var(--color-gray-9)
  }
</style>