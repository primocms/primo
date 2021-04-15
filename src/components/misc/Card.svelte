<script>
  import {fade} from 'svelte/transition'

  export let id = null
  export let title = null
  export let image = null
  export let variants = 'shadow-sm mb-2'

</script>

<div class="{variants}" {id} in:fade={{ duration: 100 }}>
  {#if title}
    <header>
      {#if title}
        <p class="text-md font-semibold mb-2">{ title }</p>
      {:else}
        <slot name="header"></slot>
      {/if}
    </header>
  {/if}
  <div class="card-body">
    {#if image}
      <article class="flex">
        <figure class="w-1/6 mr-2">
          <img src="{image}" alt="used for field">
        </figure>
        <div class="w-5/6">
          <slot></slot>
        </div>
      </article>
    {:else}
      <slot name="body"></slot>
      <slot></slot>
    {/if}
  </div>
  <slot name="footer" class="card-footer"></slot>
</div>

<style>
  .card-body {
    @apply overflow-hidden border border-gray-900;
  }
  .card-footer {
    @apply pb-2 px-4 flex justify-end;
  }
</style>