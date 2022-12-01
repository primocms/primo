<script>
  import {fly} from 'svelte/transition'
  import {find as _find} from 'lodash-es'
  import Icon from '@iconify/svelte';

  export let align = 'right'
  export let icon = null
  export let options = []

  let showingSelector = false

</script>

<div id="dropdown" class:left={align === 'left'} in:fly={{duration: 200, x: 50, opacity: 0}}>
  <button class="label" class:active={showingSelector} id="jobLabel" on:click={() => showingSelector = !showingSelector}>
    <Icon {icon} height="10" width="10" />   
    <span>Controls</span>   
    <svg id="chevron" width="12" height="15" viewBox="0 0 12 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0.163372 4.73321L0.693703 4.20288C0.81922 4.07737 1.02274 4.07737 1.14828 4.20288L5.99995 9.04303L10.8516 4.20291C10.9772 4.07739 11.1807 4.07739 11.3062 4.20291L11.8366 4.73324C11.9621 4.85876 11.9621 5.06228 11.8366 5.18782L6.22723 10.7971C6.10171 10.9226 5.89819 10.9226 5.77265 10.7971L0.163372 5.1878C0.0378277 5.06225 0.0378277 4.85873 0.163372 4.73321Z" fill="white"/>
    </svg>      
  </button>
  {#if showingSelector}
    <div class="select-container" in:fly={{duration:100, y: -20, opacity: 0}}>
      <div class="search-container">
        <div class="locale-list">
          {#each options as item}
            <button on:click={item.onclick}>
              <Icon icon={item.icon} />  
              <span>{item.label}</span>
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  #dropdown {
    display: grid;
    color: var(--primo-color-white);
    position: relative;

    &.left {
      place-content: center;
      place-items: flex-end;
    }
  }

  button.label {
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.5rem;

    svg#chevron {
      transition: 0.1s transform;
    }

    &:hover:not(.active) svg#chevron {
        transform: translateY(2px);
    }

    &.active svg#chevron {
      transform: scaleY(-1);
    }
  }

  .select-container {
    font-weight: 500;
    position: absolute;
    top: 100%;
    margin-top: 0.5rem;
    background: var(--color-gray-8);
    border-radius: var(--primo-border-radius);
    overflow: hidden;
    z-index: 999999999;

    .locale-list {
      display: grid;
      max-height: 20rem;

      button {
        display: flex;
        align-items: center;
        text-align: left;
        font-weight: 500;
        white-space: nowrap;
        padding: 0.5rem 0.75rem;
        transition: 0.1s background;

        span {
          margin-left: 0.5rem;
        }

        &:hover {
          background: var(--color-gray-7);
        }
      }
    }
  }
</style>