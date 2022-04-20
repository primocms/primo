<script>
  import { onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import Icon from '@iconify/svelte'
  import {get, set} from 'idb-keyval'

  export let id = null;
  export let title = null;

  let hidden = false

  $: if (title) get(title).then(res => {
    if (res !== undefined) {
      hidden = res
    }
  })

  onDestroy(() => {
    if (title) {
      set(title, hidden)
    }
  })
</script>

<div class="card" {id} in:fade={{ duration: 100 }}>
  {#if title}
    <button class="header-button" on:click={() => {
      hidden = !hidden
    }}>
      <header>
        <span>{title}</span>
        {#if hidden}
          <Icon icon="ph:caret-down-bold" />
        {:else}
          <Icon icon="ph:caret-up-bold" />
        {/if}
      </header>
    </button>
  {/if}
  {#if !hidden}
    <div class="card-body" transition:slide={{ duration: 100 }}>
      <slot name="body" />
      <slot />
    </div>
  {/if}
  <slot name="footer" class="card-footer" />
</div>

<style lang="postcss">
  .card {
    background: var(--color-gray-9);
    display: grid;

    button.header-button {
      width: 100%;
      padding: 1.5rem;

      & + .card-body {
        border-top: var(--input-border);
        padding-top: 2rem;
      }
    }

    header {
      width: 100%;
      font-size: var(--label-font-size);
      font-weight: var(--label-font-weight);
      display: flex;
      justify-content: space-between;
    }
    .card-body {
      border-top: 1px solid transparent;
      transition: 0.2s border-color;
      margin: 1.5rem;

      &:not(:only-child) {
        margin-top: 0;
      }
    }
    .card-footer {
      padding: 0 1rem 0.5rem 1rem;
      display: flex;
      justify-content: flex-end;
    }
  }

</style>
