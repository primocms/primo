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
  class="bg-codeblack p-2 bg-opacity-90"
  class:mounted>
  <div class="container flex items-start">
    <div
      class="navbar-menu justify-between flex-1"
      >
        <div class="w-full flex flex-wrap justify-start">
          <div class="flex flex-row rounded-sm mr-2 lg:block">
            <PrimoButton variants="py-2" on:signOut />
          </div>
          {#each buttons as group}
            <div class="flex flex-row rounded-sm mr-2">
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
    <div class="flex flex-row justify-end">
      <slot />
    </div>
  </div>
</nav>

<style>

  #primo-toolbar {
    position: fixed; 
    top: -5rem;
    left: 0;
    right: 0;
    z-index: 999;
    transition: top 1;
    will-change: top;
    backdrop-filter: blur(10px);

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
