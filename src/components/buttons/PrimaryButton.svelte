<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let id = null;
  export let variants = '';
  export let type = 'button';
  export let disabled = false;
  export let icon = null;

</script>

<button
  {id}
  class="primary-button {variants}"
  {disabled}
  on:click={(e) => dispatch('click', e)}
  {type}>
  {#if icon}<i class={icon} />{/if}
  <slot />
</button>

<style lang="postcss">
  .primary-button {
    width: 100%;
    background: var(--color-codeblack);
    color: var(--color-gray-3);
    padding: 0.5rem;
    border-bottom-right-radius: 0.25rem;
    border-bottom-left-radius: 0.25rem;
    transition: color 0.1s, background-color 0.1s;

    &:hover {
      background: var(--color-gray-9);
    }

    &[disabled] {
      background: var(--color-gray-6);
      cursor: not-allowed;
    }
  }

</style>
