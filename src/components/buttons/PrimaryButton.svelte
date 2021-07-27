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
    --PrimaryButton-bg: var(--color-primored);
    --PrimaryButton-color: var(--color-white);

    --PrimaryButton-bg-hover: var(--color-primored-dark);
    --PrimaryButton-color-hover: var(--color-white);

    width: 100%;
    background: var(--PrimaryButton-bg);
    color: var(--PrimaryButton-color);
    padding: 0.5rem;
    margin-top: var(--PrimaryButton-mt, 0);
    margin-bottom: var(--PrimaryButton-mb, 0);
    margin-left: var(--PrimaryButton-ml, 0);
    margin-right: var(--PrimaryButton-mr, 0);

    border-top-right-radius: var(--PrimaryButton-round-tr, 0.25rem);
    border-top-left-radius: var(--PrimaryButton-round-tl, 0.25rem);
    border-bottom-right-radius: var(--PrimaryButton-round-br, 0.25rem);
    border-bottom-left-radius: var(--PrimaryButton-round-bl, 0.25rem);
    transition: color 0.1s, background-color 0.1s;

    &:hover {
      background: var(--PrimaryButton-bg-hover);
      color: var(--PrimaryButton-color-hover);
    }

    &[disabled] {
      background: var(--color-gray-6);
      cursor: not-allowed;
    }
  }

</style>
