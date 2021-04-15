<script>
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher()

  export let label = null
  export let link = null
  export let iconClasses = null
  export let icon = 'atom'
  export let size = 'small'
  export let variants = ''
  export let title = null
  export let disabled = null
  export let style = ''
  export let position = 'left'
</script>

{#if link}
  <a class="bg-gray-100 px-2 py-1 mr-1 text-gray-600 text-sm rounded transition-colors duration-100 {variants}" {title} href={link.href} {style} rel={link.rel} target={link.target}>
    {#if position === 'left'}
      <span class="icon is-{size}">
        {#if iconClasses}
          <i class="{iconClasses}"></i>
        {:else}
          <i class="fas fa-{icon}"></i>
        {/if}
      </span>
    {/if}
    {#if label}
      <span>{label}</span>
    {/if}
    {#if position === 'right'}
      <span class="icon is-{size}">
        {#if iconClasses}
          <i class="{iconClasses}"></i>
        {:else}
          <i class="fas fa-{icon}"></i>
        {/if}
      </span>
    {/if}
  </a>
{:else}
  <button class="bg-gray-100 px-2 py-1 mr-1 text-gray-600 text-sm rounded transition-colors duration-100 {variants}" {title} on:click={(e) => dispatch('click', e)} {disabled} {style}>
    {#if position === 'left'}
      <span class="icon is-{size}">
        {#if iconClasses}
          <i class="{iconClasses}"></i>
        {:else}
          <i class="fas fa-{icon}"></i>
        {/if}
      </span>
    {/if}
    {#if label}
      <span>{label}</span>
    {/if}
    {#if position === 'right'}
      <span class="icon is-{size}">
        {#if iconClasses}
          <i class="{iconClasses}"></i>
        {:else}
          <i class="fas fa-{icon}"></i>
        {/if}
      </span>
    {/if}
  </button>
{/if}

<style>
  .icon + span {
    margin-left: 0.25rem;
  }

    .button:last-child {
      @apply mr-0;
    }

    .button:hover {
      @apply bg-gray-200;
    }

    .button.is-main {
      @apply bg-primored text-white;
    }


    .button.is-main:hover {
        @apply bg-red-700;
      }

  i.fa-spinner {
    animation-name: spin;
    animation-duration: 1s;
    animation-iteration-count: infinite;
    animation-timing-function: linear;
    will-change: transform;
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