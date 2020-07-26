<svelte:head>
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.11.2/css/all.min.css" integrity="sha256-+N4/V/SbAFiW1MPBCXnfnP9QSN3+Keu+NlB+0ev/YKQ=" crossorigin="anonymous" />
</svelte:head>

<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte'
  import { fade, slide } from "svelte/transition";
  import ToolbarButton from "./ToolbarButton.svelte";
  import {PrimoButton,MobileNavButton} from '@components/buttons'
  import {ButtonGroup} from './Layout/LayoutTypes'
  import {editorViewDev} from '@stores/app'

  const dispatch = createEventDispatcher()
  
  import Mousetrap from 'mousetrap'

  export let buttons:Array<ButtonGroup>;

  let mobileNavOpen = false

  let showKeyHint = false
  Mousetrap.bind('command', () => showKeyHint = true, 'keydown');
  Mousetrap.bind('command', () => showKeyHint = false, 'keyup');

</script>

<nav
  in:slide
  role="navigation"
  aria-label="toolbar"
  id="primo-toolbar">
  <div class="container">
    <div class="logo">
      <PrimoButton />
      <MobileNavButton active={mobileNavOpen} on:click={() => mobileNavOpen = !mobileNavOpen} />
    </div>
    <div
      class="navbar-menu mt-2"
      class:hidden={!mobileNavOpen}
      >
        <div class="custom-buttons">
          <div class="button-group hidden lg:block">
            <PrimoButton />
          </div>
          {#each buttons as group}
            <div class="button-group">
              {#each group as button}
                <ToolbarButton {...button} {showKeyHint} />
              {/each}
            </div>
          {/each}
          <ToolbarButton  
            title="Switch to {$editorViewDev ? 'Content' : 'Code'}"
            icon={$editorViewDev ? 'edit' : 'code'}
            onclick={() => dispatch('toggleView')}
          />
        </div>
    </div>
    <div class="secondary-buttons fixed sm:static right-0 bottom-0 mr-2 mb-2 md:m-0">
      <slot {showKeyHint} />
    </div>
  </div>
</nav>

<style>

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
    top: 0;
    left: 0;
    right: 0;
    z-index: 999;
    @apply bg-codeblack p-2;

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
