<svelte:head>
	<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.11.2/css/all.min.css" integrity="sha256-+N4/V/SbAFiW1MPBCXnfnP9QSN3+Keu+NlB+0ev/YKQ=" crossorigin="anonymous" />
</svelte:head>

<script>
  import { onMount, createEventDispatcher } from 'svelte'
  import { slide } from "svelte/transition";
  import ToolbarButton from "./ToolbarButton.svelte";
  import {PrimoButton,MobileNavButton} from '../../components/buttons'
  import {switchEnabled,userRole} from '../../stores/app'
  import {showKeyHint} from '../../stores/app/misc'
  import 'requestidlecallback-polyfill';

  const dispatch = createEventDispatcher()
  
  export let buttons;

  let mobileNavOpen = false

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
  class=""
  class:mounted>
  <div class="container menu-container">
    <div
      class="navbar-menu justify-between flex-1"
      >
        <div class="w-full flex justify-start space-x-2">
          <div class="flex flex-row lg:block">
            <PrimoButton variants="py-2" on:signOut />
          </div>
          {#each buttons as group}
            <div class="flex flex-row">
              {#each group as button}
                <ToolbarButton {...button} />
              {/each}
            </div>
          {/each}
          {#if $userRole === 'developer'}
            <ToolbarButton  
              title="Switch to {$switchEnabled ? 'CMS' : 'IDE'}"
              tooltipVariants="w-24"
              icon={$switchEnabled ? 'edit' : 'code'}
              onclick={() => dispatch('toggleView')}
              tooltipStyle="width:7rem"
            />
          {/if}
        </div>
    </div>
    <div class="primary-buttons">
      <slot />
    </div>
  </div>
</nav>

<style>

  .menu-container {
    @apply flex py-1;
  }

  .menu-container:after {
    content: '';
    z-index: -1;
    @apply w-full absolute bg-codeblack bg-opacity-90 h-full top-0 left-0; 
    backdrop-filter: blur(10px);
  }

  .primary-buttons {
    @apply flex flex-row justify-end fixed bottom-0 right-0 mr-1 mb-1 bg-codeblack p-2 rounded-sm shadow-xl;
    @apply sm:static sm:mr-0 sm:mb-0 sm:p-0 sm:rounded-none sm:shadow-none;
  }

  #primo-toolbar {
    position: fixed; 
    top: -5rem;
    left: 0;
    right: 0;
    z-index: 999;
    will-change: top;

    &.mounted {
      top: 0;
      transition: top 1s;
    }
  }

  @screen sm {
    #primo-toolbar > .container {
      @apply flex-row;
    }
  }

</style>
