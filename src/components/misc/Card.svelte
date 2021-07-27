<script>
  import { fade } from 'svelte/transition';

  export let id = null;
  export let title = null;

</script>

<div class="card" {id} in:fade={{ duration: 100 }}>
  {#if title}
    <header>
      {#if title}
        <p>{title}</p>
      {:else}
        <slot name="header" />
      {/if}
    </header>
  {/if}
  <div class="card-body">
    <slot name="body" />
    <slot />
  </div>
  <slot name="footer" class="card-footer" />
</div>

<style lang="postcss">
  .card {
    box-shadow: var(--shadow-sm);
    margin-bottom: 0.5rem;

    header {
      font-weight: 600;
      margin-bottom: 0.5rem;
    }
    .card-body {
      overflow: hidden;
      border: 1px solid var(--color-gray-9);
    }
    .card-footer {
      padding: 0 1rem 0.5rem 1rem;
      display: flex;
      justify-content: flex-end;
    }
  }

</style>
