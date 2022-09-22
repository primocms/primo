<script>
  import { fade } from 'svelte/transition'
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher();

  export let title = null;
  export let loading = false
  export let style = '';
  export let id = null
  export let variants = ''

</script>

<button
  {title}
  {style}
  {id}
  class="primo-button is-light {variants}"
  class:is-loading={loading}
  transition:fade
  on:click={() => dispatch('click')}>
  <slot></slot>
</button>

<style>

</style>
