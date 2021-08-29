<script>
  import { fade } from 'svelte/transition';
  import dropdown from '../../stores/app/dropdown';
  import { loadingSite } from '../../stores/app/misc';
  import Spinner from '../../ui/misc/Spinner.svelte';
  import PrimoLogo from '../svg/PrimoLogo.svelte';
  import DropdownButton from './DropdownButton.svelte';

  export let variants = '';

  let showingDropdown = false;

</script>

{#if $dropdown.length > 0}
  <button
    id="primo-button"
    transition:fade
    class={variants}
    class:bg-primored={showingDropdown}
    class:chevron={showingDropdown}
    aria-label="See all sites"
    on:click={() => (showingDropdown = !showingDropdown)}>
    {#if $loadingSite}
      <Spinner />
    {:else}
      <PrimoLogo style={showingDropdown ? 'white' : 'red'} />
    {/if}
  </button>
{/if}

{#if showingDropdown}
  <ul xyz="fade stagger stagger-1" class="dropdown">
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

<style lang="postcss">
  #primo-button {
    padding: 0.35rem;
    display: block;
    height: 100%;
    background: var(--primo-color-codeblack);
    transition: background 0.1s;
    width: 2.5rem;
    background-size: 2rem;
    background-repeat: no-repeat;
    background-position: center;
    outline: 0;

    &:hover,
    &:focus {
      background: var(--color-gray-8);
    }

    &.chevron {
      position: relative;
    }

    &.chevron:before,
    &.chevron:after {
      content: ' ';
      position: absolute;
      height: 0;
      width: 0;
      bottom: -16px;
      pointer-events: none;
      left: 21px;

      border: 7px solid var(--primo-color-codeblack-opaque);
      border-top-color: transparent;
      border-left-color: transparent;
      border-right-color: transparent;
      margin-left: -7px;
    }
  }

  ul.dropdown {
    background-color: var(--primo-color-codeblack-opaque);
    backdrop-filter: blur(10px);
    width: 20rem;
    max-height: calc(100vh - 5rem);
    z-index: 99;
    top: calc(100% + 0.75rem);
    overflow: scroll;
    position: absolute;
    border-radius: var(--border-radius-1);
    padding: 1rem;
    box-shadow: var(--box-shadow-xl);

    li:not(:last-child) {
      margin-bottom: 1rem;
    }
  }

</style>
