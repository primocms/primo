<script>
  import {flatten} from 'lodash'
  import {getContext, createEventDispatcher} from 'svelte'
  import {fade} from 'svelte/transition'
  import PageItem from '../../@modal/PageList/PageItem.svelte'
  import SiteButton from './SiteButton.svelte'
  import {site, allSites} from '../../@stores/data'
  import PrimoLogo from '../../@svg/PrimoLogo.svelte'

  const dispatch = createEventDispatcher()

  const showDashboardLink = getContext('showDashboardLink')

  export let variants = ''

  let showingDropdown = false
</script>

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

{#if showingDropdown}
  <div class="dropdown" out:fade={{duration:100}}>
    {#if showDashboardLink}
      <a class="dashboard-button mb-4" href="https://primocloud.io">
        <i class="fas fa-arrow-left mr-1"></i>
        <span>Go back to Dashboard</span>
      </a>
    {/if}
    <nav>
      <p class="dropdown-heading">sites</p>
      <ul>
        {#each $allSites as site}
          <li class="site-item">
            <SiteButton {site} isLink={showDashboardLink}/>
          </li>
        {/each}
      </ul>
    </nav>
    <a class="dashboard-button my-2" href="http://discuss.primo.so/">
      <i class="fas fa-users mr-1"></i>
      <span>Get help</span>
    </a>
    {#if showDashboardLink}
      <button class="dashboard-button my-2" on:click={() => dispatch('signOut')}>
        <i class="fas fa-sign-out-alt mr-1"></i>
        <span>Sign Out</span>
      </button>
    {/if}
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
    &.chevron:before, &.chevron:after {
      content: " ";
      @apply absolute h-0 w-0 border-solid border-primored;
      bottom: -13px;
      pointer-events: none;
      left: 21px;
      border-top-color: transparent;
      border-left-color: transparent;
      border-right-color: transparent;
      border-width: 7px;
      margin-left: -7px;
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
    @apply absolute bg-primored rounded overflow-scroll p-4;

    ul {
      @apply grid grid-cols-2 gap-2 mt-2 pb-4;
    }
  }

  .dashboard-button {
    @apply block px-4 py-2 bg-red-500 text-red-100 rounded transition-colors duration-100 w-full text-xs text-center;
    &:hover {
      @apply bg-red-600;
    }
  }

  .site-item {
    @apply shadow-lg relative overflow-hidden;
    height: 15vh;
  }

</style>