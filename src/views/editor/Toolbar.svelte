<svelte:head>
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.11.2/css/all.min.css" integrity="sha256-+N4/V/SbAFiW1MPBCXnfnP9QSN3+Keu+NlB+0ev/YKQ=" crossorigin="anonymous" />
</svelte:head>

<script lang="ts">
  import { onMount, createEventDispatcher, getContext } from 'svelte'
  import { fade, slide } from "svelte/transition";
  import Mousetrap from 'mousetrap'
  import ToolbarButton from "./ToolbarButton.svelte";
  import {PrimoButton,MobileNavButton} from '../../components/buttons'
  import type {ButtonGroup} from './Layout/LayoutTypes'
  import {editorViewDev,userRole,hideReleaseNotes} from '../../stores/app'
  import modal from '../../stores/app/modal'

  const dispatch = createEventDispatcher()
  

  export let buttons:Array<ButtonGroup>;

  let mobileNavOpen = false

  let showKeyHint = false
  Mousetrap.bind('command', () => showKeyHint = true, 'keydown');
  Mousetrap.bind('command', () => showKeyHint = false, 'keyup');

  let mounted = false
  onMount(() => {
    mounted = true
  })

</script>

<nav
  in:slide
  role="navigation"
  aria-label="toolbar"
  id="primo-toolbar"
  class:mounted>
  <div class="container">
    <div class="logo">
      <PrimoButton on:signOut />
      <MobileNavButton active={mobileNavOpen} on:click={() => mobileNavOpen = !mobileNavOpen} />
    </div>
    <div
      class="navbar-menu mt-2"
      class:hidden={!mobileNavOpen}
      >
        <div class="custom-buttons">
          <div class="button-group hidden lg:block">
            <PrimoButton on:signOut />
          </div>
          {#each buttons as group}
            <div class="button-group">
              {#each group as button}
                <ToolbarButton {...button} {showKeyHint} />
              {/each}
            </div>
          {/each}
          {#if $userRole === 'developer'}
            <ToolbarButton  
              title="Switch to {$editorViewDev ? 'CMS' : 'IDE'}"
              tooltipVariants="w-24"
              icon={$editorViewDev ? 'edit' : 'code'}
              onclick={() => dispatch('toggleView')}
              tooltipStyle="width:7rem"
            />
            <!-- {#if !$hideReleaseNotes}
              <button class="release-notes" on:click={() => modal.show('RELEASE_NOTES')}>
                <i class="fas fa-book-open mr-1"></i>
                <span>Release Notes</span>
              </button>
            {/if} -->
          {/if}
        </div>
    </div>
    <div class="secondary-buttons fixed sm:static right-0 bottom-0 mr-2 mb-2 md:m-0">
      <slot {showKeyHint} />
    </div>
  </div>
</nav>

<style>

  .release-notes {
    @apply font-semibold px-4 ml-4 text-primored text-sm border-l border-gray-700 transition-colors duration-200;
    &:hover {
      @apply bg-gray-800 text-white border-transparent rounded;
    }
  }

  .logo {
    @apply flex justify-between items-center px-2;
  }

  .secondary-buttons {
    @apply flex flex-row justify-end;
  }

  .button-group {
    @apply flex my-1 mx-2 flex-row border border-solid border-gray-800 rounded-sm mr-2;
  }

  .container {
    @apply flex justify-between;
  }

  .custom-buttons {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  #primo-toolbar {
    position: fixed; 
    top: -5rem;
    left: 0;
    right: 0;
    z-index: 999;
    transition: top 1;
    will-change: top;
    @apply bg-codeblack p-2;

    &.mounted {
      top: 0;
      transition: top 1s;
    }

    & > .container {
      @apply flex-col;
    }
  }

  .navbar-menu {
    @apply justify-between flex-1;
  }

  @screen sm {
    .logo {
      @apply hidden;
    }
    #primo-toolbar > .container {
      @apply flex-row;
    }
    .navbar-menu {
      @apply mt-0 block;
    }
    .button-group {
      @apply m-0 mr-1;
    }
  }

</style>
