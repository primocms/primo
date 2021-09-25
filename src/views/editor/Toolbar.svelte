<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import ToolbarButton from './ToolbarButton.svelte';
  import { PrimoButton, MobileNavButton } from '../../components/buttons';
  import { switchEnabled, userRole } from '../../stores/app';
  import { onMobile } from '../../stores/app/misc';
  import { showKeyHint } from '../../stores/app/misc';
  const dispatch = createEventDispatcher();

  export let buttons;
  export let element;

  let mobileNavOpen = false;

  let mounted = false;
  onMount(() => {
    mounted = true;
  });

</script>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.11.2/css/all.min.css"
    integrity="sha256-+N4/V/SbAFiW1MPBCXnfnP9QSN3+Keu+NlB+0ev/YKQ="
    crossorigin="anonymous" />
</svelte:head>
<nav
  bind:this={element}
  role="navigation"
  aria-label="toolbar"
  id="primo-toolbar"
  class="primo-reset"
  class:mounted>
  <div class="menu-container">
    <div class="left">
      <PrimoButton variants="py-2" on:signOut />
      {#each buttons as group}
        <div class="buttons">
          {#each group as button}
            <ToolbarButton {...button} />
          {/each}
        </div>
      {/each}
    </div>
    <div class="primary-buttons">
      {#if $userRole === 'developer'}
        <div class="content" id="ide-toggle">
          <label class="switch">
            <input
              type="checkbox"
              bind:checked={$switchEnabled}
              on:click={() => dispatch('toggleView')} />
            <span class="slider" class:code={$switchEnabled}>
              <svg
                id="cms"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor">
                <path
                  d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                <path
                  fill-rule="evenodd"
                  d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
                  clip-rule="evenodd" />
              </svg>
              <svg
                id="ide"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor">
                <path
                  fill-rule="evenodd"
                  d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z"
                  clip-rule="evenodd" />
              </svg>
            </span>
            <span class="sr-only">Switch to
              {$switchEnabled ? 'CMS' : 'IDE'}</span>
          </label>
          {#if !$onMobile}
            <div class="tooltip">
              Switch to
              {$switchEnabled ? 'CMS' : 'IDE'}
            </div>
          {/if}
        </div>
      {/if}
      <slot />
    </div>
  </div>
</nav>

<style lang="postcss">
  nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 999999999;
    -webkit-app-region: drag;
  }
  .left {
    width: 100%;
    display: flex;
    justify-content: flex-start;
  }
  .left .buttons {
    display: flex;
    flex-direction: row;
    margin-right: 0.25rem;
  }
  .content {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-right: 0.5rem;
    padding-left: 0.5rem;
  }

  .switch {
    position: relative;
    display: flex;
    align-items: center;
    width: 50px;
    height: 26px;
  }

  .switch svg {
    height: 100%;
    display: flex;
    align-items: center;
    width: 50%;
    justify-content: center;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgb(248, 68, 73);
    transition: 0.4s;
    display: flex;
    align-items: center;
    border-radius: 34px;
  }

  .slider svg {
    padding: 5px;
    z-index: 1;
  }

  .slider #ide {
    color: white;
  }

  .slider #cms {
    color: rgb(248, 68, 73);
  }

  .slider.code #ide {
    color: rgb(248, 68, 73);
  }

  .slider.code #cms {
    color: white;
  }

  .slider:before {
    border-radius: 50%;
    position: absolute;
    content: '';
    height: 20px;
    width: 20px;
    left: 3px;
    z-index: 1;
    background-color: white;
    transition: background-color 0.4s, transform 0.1s;
    box-shadow: 0px 0px 3px 0px rgb(0 0 0 / 50%);
  }

  input:focus + .slider {
    outline: none;
  }

  input:checked + .slider:before {
    transform: translateX(24px);
    transition: 0.1s;
  }

  .menu-container {
    display: flex;
    margin: 0 auto;
    /* padding: 4px var(--padding-container); */
    padding: 2px;
    max-width: var(--max-width-container);
  }

  .menu-container:after {
    background: var(--primo-color-black-opaque);
    content: '';
    z-index: -1;
    height: 100%;
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    backdrop-filter: blur(10px);
  }

  .primary-buttons {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    background: var(--primo-color-codeblack);
    border-radius: 2px;
    box-shadow: var(--box-shadow-xl);
    border-top-left-radius: 21px;
    border-bottom-left-radius: 21px;
  }

  .switch:hover + .tooltip {
    visibility: visible;
    opacity: 1;
    transition: opacity 0.2s;
  }

  .tooltip {
    position: absolute;
    text-align: center;
    color: var(--color-gray-1);
    font-weight: 700;
    background: var(--color-gray-8);
    padding: 8px 16px;
    font-size: var(--font-size-2);
    pointer-events: none;
    visibility: hidden;
    opacity: 0;
    transition: opacity 0.2s;
    left: 50%;
    transform: translateX(-50%);
    top: calc(100% + 0.75rem);
    width: 6rem;
  }

  .tooltip:before,
  .tooltip:after {
    content: ' ';
    height: 0;
    width: 0;
    border: 1px solid var(--color-gray-8);
    border-top-color: transparent;
    border-left-color: transparent;
    border-right-color: transparent;
    bottom: 100%;
    left: 50%;
    position: absolute;
    pointer-events: none;
    border-width: 7px;
    margin-left: -7px;
  }

  @media (min-width: 1024px) {
    .tooltip {
      display: block;
    }
  }

</style>
