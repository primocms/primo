<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let label = null;
  export let link = null;
  export let iconClasses = null;
  export let icon = 'atom';
  export let size = 'small';
  export let variants = '';
  export let title = null;
  export let disabled = null;
  export let style = '';
  export let position = 'left';

</script>

{#if link}
  <a
    class={variants}
    {title}
    href={link.href}
    {style}
    rel={link.rel}
    target={link.target}>
    {#if position === 'left'}
      <span class="icon is-{size}">
        {#if iconClasses}
          <i class={iconClasses} />
        {:else}<i class="fas fa-{icon}" />{/if}
      </span>
    {/if}
    {#if label}<span>{label}</span>{/if}
    {#if position === 'right'}
      <span class="icon is-{size}">
        {#if iconClasses}
          <i class={iconClasses} />
        {:else}<i class="fas fa-{icon}" />{/if}
      </span>
    {/if}
  </a>
{:else}
  <button
    class={variants}
    {title}
    on:click={(e) => dispatch('click', e)}
    {disabled}
    {style}>
    {#if position === 'left'}
      <span class="icon is-{size}">
        {#if iconClasses}
          <i class={iconClasses} />
        {:else}<i class="fas fa-{icon}" />{/if}
      </span>
    {/if}
    {#if label}<span>{label}</span>{/if}
    {#if position === 'right'}
      <span class="icon is-{size}">
        {#if iconClasses}
          <i class={iconClasses} />
        {:else}<i class="fas fa-{icon}" />{/if}
      </span>
    {/if}
  </button>
{/if}

<style lang="postcss">
  a,
  button {
    border-radius: var(--primo-border-radius);
    font-size: var(--font-size-2);
    color: var(--color-gray-6);
    background: var(--color-gray-1);
    padding: 0.25rem 0.5rem;
    margin-right: 0.25rem;
    transition: background-color 0.1s, color 0.1s;

    .icon + span {
      margin-left: 0.25rem;
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

</style>
