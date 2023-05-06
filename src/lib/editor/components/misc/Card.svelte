<script>
  import { onDestroy } from 'svelte'
  import { fade, slide } from 'svelte/transition'
  import Icon from '@iconify/svelte'
  import { get, set } from 'idb-keyval'

  export let id = null
  export let title = null
  export let pill = null

  let hidden = false

  $: if (title)
    get(title).then((res) => {
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

<div class="card" {id}>
  {#if title}
    <button
      class="header-button"
      on:click={() => {
        hidden = !hidden
      }}
    >
      <header>
        <div>
          <span>{title}</span>
          {#if pill}
            <span class="pill">{pill}</span>
          {/if}
        </div>
        {#if hidden}
          <Icon icon="ph:caret-down-bold" />
        {:else}
          <Icon icon="ph:caret-up-bold" />
        {/if}
      </header>
    </button>
  {/if}
  {#if !hidden}
    <div class="card-body">
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
  }
  button {
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

    .pill {
      background: #b6b6b6;
      border-radius: 100px;
      padding: 3px 7px;
      font-size: 12px;
      font-weight: 500;
      color: #121212;
      margin-left: 0.5rem;
    }
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
</style>
