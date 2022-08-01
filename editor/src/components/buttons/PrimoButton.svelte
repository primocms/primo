<script>
  import dropdown from '../../stores/app/dropdown';
  import { loadingSite } from '../../stores/app/misc';
  import Spinner from '../../components/misc/Spinner.svelte';
  import PrimoLogo from '../svg/PrimoLogo.svelte';
  import DropdownButton from './DropdownButton.svelte';


  export let variants = '';

  let showingDropdown = false;

  function handleToggle() {
    showingDropdown = !showingDropdown
  }
</script>

<button
  id="primo-button"
  class={variants}
  class:bg-primored={showingDropdown}
  class:chevron={showingDropdown}
  aria-label="See all sites"
  href="/"
  on:click={() => showingDropdown = !showingDropdown}
>
  {#if $loadingSite}
    <Spinner />
  {:else}
    <PrimoLogo style={showingDropdown ? 'white' : 'red'} />
  {/if}
</button>

{#if showingDropdown}
  <ul xyz="fade stagger stagger-1" class="dropdown">
    {#each $dropdown as button}
      <li class="xyz-in">
        {#if button.component}
          <svelte:component this={button.component} {...button.props} on:toggle={handleToggle} />
        {:else}
          <DropdownButton {button} />
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style lang="postcss">
  #primo-button {
    aspect-ratio: 1;
    margin-right: 0.5rem;
    padding: 0.5rem;
    border-radius: var(--primo-border-radius);
    display: block;
    height: 100%;
    background: var(--primo-color-codeblack);
    transition: background 0.1s;
    width: 2.5rem;
    background-size: 2rem;
    background-repeat: no-repeat;
    background-position: center;
    outline: 0;
    display: flex;
    justify-content: center;
    align-items: center;

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
      bottom: -24px;
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
    border-radius: var(--primo-border-radius);
    padding: 1rem;
    box-shadow: var(--box-shadow-xl);

    li:not(:last-child) {
      margin-bottom: 1rem;
    }
  }
</style>
