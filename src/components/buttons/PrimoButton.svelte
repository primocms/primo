<script>
  import {fade} from 'svelte/transition'
  import dropdown from '../../stores/app/dropdown'
  import {loadingSite} from '../../stores/app/misc'
  import Spinner from '../../ui/misc/Spinner.svelte'
  import PrimoLogo from '../svg/PrimoLogo.svelte'
  import DropdownButton from './DropdownButton.svelte'

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
    {#if $loadingSite}
      <Spinner />
    {:else}
      <PrimoLogo style={showingDropdown ? 'white' : 'red'} />
    {/if}
  </button>
{/if}

{#if showingDropdown}
  <ul xyz="fade stagger stagger-1" class="dropdown space-y-4 bg-codeblack bg-opacity-95">
    {#each $dropdown as button}
      <li class="xyz-in">
        {#if button.component}
          <svelte:component this={button.component} {...button.props} />
        {:else}
          <DropdownButton {button} />
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>

  #primo-button {
    padding: 0.35rem;
    @apply block h-full bg-codeblack transition-colors duration-100 w-10 bg-no-repeat bg-center outline-none;
    background-size: 2rem;
  }

  #primo-button:hover, #primo-button:focus {
      @apply bg-gray-800 transition-colors duration-200;
    }

    #primo-button.chevron {
      @apply relative;
    }

    #primo-button.chevron:before, #primo-button.chevron:after {
        content: " ";
        @apply absolute h-0 w-0 border-solid border-codeblack;
        bottom: -24px;
        pointer-events: none;
        left: 21px;
        border-top-color: transparent;
        border-left-color: transparent;
        border-right-color: transparent;
        border-width: 7px;
        margin-left: -7px;
      }

  .dropdown-heading {
    @apply uppercase text-gray-100 text-xs font-bold;
  }

  .dropdown {
    width: 20rem;
    max-height: calc(100vh - 5rem);
    z-index: 99;
    top: calc(100% + 0.75rem);
    @apply overflow-scroll absolute shadow-xl rounded p-4;
  }

</style>