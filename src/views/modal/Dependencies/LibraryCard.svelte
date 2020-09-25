<script>
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  import {fade} from 'svelte/transition'
  import {IconButton} from '../../../components/buttons'

  export let library
  export let i
  export let button = null
  export let valid = true

  $: typeLabel = library.type ? library.type.toUpperCase() : null
</script>

<li class="list-item" in:fade={{ delay: 100 * i, duration: 100 }} title={ library.type === 'js' ? `Accessible from within component JavaScript as ${library.name}` : ''}>
    <div class="flex-3">
      {#if !valid}
        <span class="bg-red-500 text-white font-medium block mb-2 py-1 px-2 rounded">Invalid file type. Expected JS or CSS but got {typeLabel}</span>
      {/if}
      <strong>{library.name} { typeLabel ? `(${typeLabel})` : ''}<span class="type">| {library.version}</span></strong>
      <p class="description">{library.description}</p>
      <div class="buttons">
        {#each library.links as link}
          {#if link.site === 'repository'}
            <a class="mr-1" aria-label="{library.name} github" href={link.href} target="blank" rel="nofollow">
              <i class="fab fa-github"></i>
            </a>
          {:else if link.site === 'homepage'}
            <a class="mr-1" aria-label="{library.name} homepage" href={link.href} target="blank" rel="nofollow">
              <i class="fas fa-globe"></i>
            </a>
          {:else if link.site === 'npme'}
            <a class="mr-1" aria-label="{library.name} npm" href={link.href} target="blank" rel="nofollow">
              <i class="fab fa-npm"></i>
            </a>
          {/if}
        {/each}
      </div>
    </div>
    <div class="flex-1 flex justify-end">
      {#if button}
        <button class="bg-gray-900 text-gray-100 py-2 px-3 text-xs rounded font-semibold" on:click={button.onclick}>{button.label}</button>
      {/if}
    </div>
</li>

<style>
  .buttons {
    margin-top: 0.5rem;
  }
  .description {
    font-size: 14px;
  }
  .type {
    display: inline-block;
    margin-left: 0.5rem;
    font-weight: 500;
  }
  .list-item {
    @apply flex justify-between items-center px-4 py-2 shadow;
  }
</style>