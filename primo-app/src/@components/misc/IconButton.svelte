<script>
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  export let label = null
  export let icon = 'atom';
  export let size = 'small';
  export let variants = '';
  export let title = null;
  export let disabled = null
  export let style = ''
</script>

<button class="button {variants}" {title} on:click={(e) => dispatch('click', e)} {disabled} {style}>
  <span class="icon is-{size}">
    <i class="fas fa-{icon}"></i>
  </span>
  {#if label}
    <span>{label}</span>
  {/if}
</button>