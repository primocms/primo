<script>
  import {getContext, createEventDispatcher} from 'svelte'
  import {fade} from 'svelte/transition'
  import {allSites} from '../../stores/data'
  import dropdown from '../../stores/app/dropdown'
  import site from '../../stores/data/site'
  import {pageId} from '../../stores/data/page'
  import PrimoLogo from '../../components/svg/PrimoLogo.svelte'
  import DropdownButton from './DropdownButton.svelte'

  const dispatch = createEventDispatcher()

  export let variants = ''

  let showingDropdown = false

  function createSite() {
    const newSite = allSites.create()
    site.set(newSite)
    pageId.set('index')
  }

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

{#if showingDropdown}
  <div class="dropdown" out:fade={{duration:100}}>
    {#each $dropdown as button}
      {#if button.component}
        <svelte:component this={button.component} {...button.props} />
      {:else}
        <DropdownButton {button} />
      {/if}
    {/each}
    <!-- <nav>
      <p class="dropdown-heading">sites</p>
      <ul>
        {#each $allSites as siteItem}
          <li class="site-item" class:active={siteItem.id === $site.id}>
            <SiteButton active={siteItem.id === $site.id} site={siteItem} isLink={showDashboardLink}/>
          </li>
        {/each}
        {#if !showDashboardLink}
          <li class="site-item">
            <button on:click={createSite} class="text-gray-100 font-semibold text-xs flex items-center justify-center h-full w-full transition-colors duration-100 hover:bg-red-600">
              <i class="fas fa-plus mr-1"></i>
              <span>Create site</span>
            </button>
          </li>
        {/if}
      </ul>
    </nav> -->

  </div>
{/if}

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
    @apply absolute bg-primored shadow-xl rounded p-4;

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
  }

  .site-item {
    @apply shadow-lg relative overflow-hidden;
    height: 15vh;
    &.active {
      outline: 5px solid rgb(30,30,30);
    }
  }

</style>