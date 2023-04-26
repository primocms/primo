<script>
  import Icon from '@iconify/svelte'
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  export let icon = 'carbon:overflow-menu-vertical'
  export let color = null
  let clicked = false
</script>

<button class="show-menu" class:active={clicked} on:click style:color>
  <Icon {icon} />
</button>

<style lang="postcss">
  button.show-menu {
    flex: 1;
    padding: 0.25rem;
    transition: 0.1s;
    border-radius: 4px;
    transition: 0.1s;
    /* opacity: 0; */
    opacity: var(--IconButton-opacity, 1);

    &:hover,
    &.active {
      /* background: #f4f4f6; */
      /* opacity: 1; */
    }
  }
</style>
