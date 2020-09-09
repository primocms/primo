<script>
  import {fade} from 'svelte/transition'
  import {IconButton} from '../../components/buttons'
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  import modal from '../../stores/app/modal'
  import content from '../../stores/data/page/content'

  let fullwidth = false
  let gapless = false

  $: sections = [
    [
      'w-full'
    ],
    [
      `w-full md:w-1/2 ${!gapless ? 'md:pr-3' : ''}`,
      `w-full md:w-1/2 ${!gapless ? 'md:pl-3' : ''}`
    ],
    [
      `w-full md:w-1/3 ${!gapless ? 'md:pr-3' : ''}`,
      `w-full md:w-1/3 ${!gapless ? 'md:px-3' : ''}`,
      `w-full md:w-1/3 ${!gapless ? 'md:pl-3' : ''}`
    ],
    [
      `w-full md:w-2/3 ${!gapless ? 'md:pr-3' : ''}`,
      `w-full md:w-1/3 ${!gapless ? 'md:pl-3' : ''}`
    ],
    [
      `w-full md:w-1/3 ${!gapless ? 'md:pr-3' : ''}`,
      `w-full md:w-2/3 ${!gapless ? 'md:pl-3' : ''}`
    ],
  ]

  function selectSection(columns) {
    content.insertSection({
      fullwidth,
      gapless,
      columns
    })
    modal.hide()
  }

</script>

<div class="flex w-full">
  <button on:click={() => fullwidth = !fullwidth} class="flex-1 py-2 bg-gray-200 text-gray-800 text-sm border border-gray-100 transition-colors duration-100 hover:bg-gray-300" type="checkbox" class:border-gray-500={fullwidth}>Fullwidth</button>
  <button on:click={() => gapless = !gapless} class="flex-1 py-2 bg-gray-200 text-gray-800 text-sm border border-gray-100 transition-colors duration-100 hover:bg-gray-300" type="checkbox" class:border-gray-500={gapless}>Gapless</button>
</div>
{#each sections as columns}
  <article class="my-2 shadow" transition:fade={{ delay: 250, duration: 200 }}>
    <div class="flex justify-end">
      <button on:click={() => selectSection(columns)} class="add-to-page">
        <i class="fas fa-plus-circle"></i>
        <span>Add to Page</span>
      </button>
    </div>
    <div class="column-container" class:fullwidth>
      <div class="flex flex-wrap" class:is-gapless={gapless}>
        {#each columns as column}
          <div class="column {column}">
            <div class="placeholder"></div>
          </div>
        {/each}
      </div>
    </div>
  </article>
{/each}


<style>
  .column-container {
    @apply pt-4 pl-4 pr-4 pb-4;
    transition: padding-left 0.5s, padding-right 0.5s;
  }
  button.add-to-page {
    @apply text-xs px-4 py-2 bg-primored text-white transition-colors duration-100;
    &:hover {
      @apply bg-red-700;
    }
  }
  .column-container.fullwidth {
    /* padding: 1.25em 0 !important; */
    padding-left: 0 !important;
    padding-right: 0 !important;
    transition: padding-left 0.5s, padding-right 0.5s;
  }
  .column-container.fullwidth .column:first-child {
    @apply pl-0;
  }
  .column-container.fullwidth .column:last-child {
    @apply pr-0;
  }
  .message-body {
    transition: padding 0.25s;
  }
  .placeholder {
    @apply bg-gray-500;
    height: 2rem;
  }
  .columns {
    margin: 0 !important;
  }
  .is-gapless>.column {
    transition: padding 0.25s;
    border-left: 1px solid whitesmoke;
    border-right: 1px solid whitesmoke;
    padding: 0;
  }
  .is-gapless>.column:last-child {
    border-right: 0;
  }
  .is-gapless>.column:first-child {
    border-left: 0;
  }
  .column {
    transition: padding 0.25s;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
    outline: 1px solid transparent;
    outline-color: transparent;
    transition: 0.25s outline-color;
  }
</style>