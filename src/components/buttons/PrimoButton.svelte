<script>
  import {getContext, createEventDispatcher} from 'svelte'
  import {fade} from 'svelte/transition'
  import {allSites} from '../../stores/data'
  import dropdown from '../../stores/app/dropdown'
  import PrimoLogo from '../../components/svg/PrimoLogo.svelte'
  import DropdownButton from './DropdownButton.svelte'

  const dispatch = createEventDispatcher()

  export let variants = ''

  let showingDropdown = false

</script>

{#if $dropdown.length > 0}
  <button
    id="primo-button"
    transition:fade
    class={variants}
    class:bg-primored={showingDropdown}
    class:chevron={showingDropdown}
    aria-label="See all sites"
    on:click={() => showingDropdown = !showingDropdown}
    >
    <PrimoLogo style={showingDropdown ? 'white' : 'red'} />
  </button>
{/if}

<div class="dropdown" class:fadein={showingDropdown}>
  {#each $dropdown as button}
    {#if button.component}
      <svelte:component this={button.component} {...button.props} />
    {:else}
      <DropdownButton {button} />
    {/if}
  {/each}
</div>

<style>

  #primo-button {
    padding: 0.35rem;
    @apply block h-full bg-codeblack transition-colors duration-100 w-10 bg-no-repeat bg-center outline-none;
    background-size: 2rem;
    &.bg-primored {
      @apply bg-primored;
    }
    &:hover, &:focus {
      @apply bg-gray-800 transition-colors duration-200;
    }
  }

  .dropdown-heading {
    @apply uppercase text-gray-100 text-xs font-bold;
  }

  .dropdown {
    width: 20rem;
    max-height: calc(100vh - 5rem);
    z-index: 99;
    top: calc(100% + 0.75rem);
    @apply absolute bg-primored shadow-xl rounded p-4 opacity-0 transition-opacity duration-100 pointer-events-none;

    &:before, &:after {
      content: " ";
      @apply absolute h-0 w-0 border-solid border-primored;
      top: -14px;
      pointer-events: none;
      left: 21px;
      border-top-color: transparent;
      border-left-color: transparent;
      border-right-color: transparent;
      border-width: 7px;
      margin-left: -7px;
    }

    ul {
      @apply grid grid-cols-2 gap-2 mt-2 pb-4;
    }

    &.fadein {
      @apply opacity-100 pointer-events-auto;
    }
  }



</style>