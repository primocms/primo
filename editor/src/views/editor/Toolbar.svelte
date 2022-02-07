<script>
  import { onMount, createEventDispatcher } from 'svelte';
  import {find as _find} from 'lodash-es'
  import ToolbarButton from './ToolbarButton.svelte';
  import LocaleSelector from './LocaleSelector.svelte'
  import { PrimoButton } from '../../components/buttons';
  import { name } from '../../stores/data/draft';
  import { showingIDE, userRole } from '../../stores/app';
  import { id as pageID } from '../../stores/app/activePage';
  import { onMobile } from '../../stores/app/misc';
  import modal from '../../stores/app/modal'
  const dispatch = createEventDispatcher();

  export let buttons;
  export let element;

  let mounted = false;
  onMount(() => {
    mounted = true;
  });

</script>

<div id="primo-desktop-toolbar-overlay">
  <div>
    {$name} <span>/{$pageID === 'index' ? '' : $pageID}</span>
  </div>
</div>
<nav
role="navigation"
aria-label="toolbar"
id="primo-toolbar"
class="primo-reset"
class:mounted>
<div class="menu-container" bind:this={element}>
  <div class="left">
    <PrimoButton variants="py-2" on:signOut />
    {#each buttons as group}
      <div class="buttons">
        {#each group as button}
          <ToolbarButton {...button} />
        {/each}
      </div>
    {/each}
    <a href="https://docs.primo.af" class="toolbar-link text-link" target="blank">
      <span>Docs</span>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><!-- Font Awesome Pro 5.15.4 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) --><path fill="currentColor" d="M432,320H400a16,16,0,0,0-16,16V448H64V128H208a16,16,0,0,0,16-16V80a16,16,0,0,0-16-16H48A48,48,0,0,0,0,112V464a48,48,0,0,0,48,48H400a48,48,0,0,0,48-48V336A16,16,0,0,0,432,320ZM474.67,0H316a28,28,0,0,0-28,28V46.71A28,28,0,0,0,316.79,73.9L384,72,135.06,319.09l-.06.06a24,24,0,0,0,0,33.94l23.94,23.85.06.06a24,24,0,0,0,33.91-.09L440,128l-1.88,67.22V196a28,28,0,0,0,28,28H484a28,28,0,0,0,28-28V37.33h0A37.33,37.33,0,0,0,474.67,0Z"/></svg>
    </a>
    <button class="toolbar-link text-link" on:click={() => modal.show('DIALOG', { component: 'FEEDBACK' })}>
      <span>Feedback</span>
      <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="comment-alt-smile" class="svg-inline--fa fa-comment-alt-smile fa-w-16" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M448 0H64C28.7 0 0 28.7 0 64v288c0 35.3 28.7 64 64 64h96v84c0 9.8 11.2 15.5 19.1 9.7L304 416h144c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64zM320 133.2c14.8 0 26.8 12 26.8 26.8s-12 26.8-26.8 26.8-26.8-12-26.8-26.8 12-26.8 26.8-26.8zm-128 0c14.8 0 26.8 12 26.8 26.8s-12 26.8-26.8 26.8-26.8-12-26.8-26.8 12-26.8 26.8-26.8zm164.2 140.9C331.3 303.3 294.8 320 256 320c-38.8 0-75.3-16.7-100.2-45.9-5.8-6.7-5-16.8 1.8-22.5 6.7-5.7 16.8-5 22.5 1.8 18.8 22 46.5 34.6 75.8 34.6 29.4 0 57-12.6 75.8-34.7 5.8-6.7 15.9-7.5 22.6-1.8 6.8 5.8 7.6 15.9 1.9 22.6z"></path></svg>
    </button>
  </div>
  <div class="primary-buttons">
    {#if !$showingIDE}
      <LocaleSelector />
    {/if}
    {#if $userRole === 'developer'}
      <div class="content" id="ide-toggle">
        <label class="switch">
          <input
            type="checkbox"
            bind:checked={$showingIDE}
            on:click={() => dispatch('toggleView')} />
          <span class="slider" class:code={$showingIDE}>
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
            {$showingIDE ? 'CMS' : 'IDE'}</span>
        </label>
        {#if !$onMobile}
          <div class="tooltip">
            Switch to
            {$showingIDE ? 'CMS' : 'IDE'}
          </div>
        {/if}
      </div>
    {/if}
    <slot />
  </div>
</div>
</nav>


<style lang="postcss">
  #primo-desktop-toolbar-overlay {
    display: block !important;
    height: 30px;
    -webkit-app-region: drag;
    background-color: var(--color-codeblack);
    user-select: none;
    border-bottom: 1px solid var(--color-gray-9);
    z-index: 9999999999; /* should be above #primo-toolbar */
    position: fixed;
    top: 0;
    left: 0;
    right: 0;

    div {
      color: var(--color-gray-3);
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      height: 100%;
      padding-left: 5rem;

      span {
        margin-left: 0.25rem;
        color: var(--color-gray-5);
      }

    }
  }
  
  #primo-toolbar {
    position: fixed;
    left: 0;
    right: 0;
    top: -10rem;
    z-index: 999999999;
    padding-top: 40px;
    transition: 0.2s top;
    transition-delay: 0.5s;
    will-change: top;

    &.mounted {
      top: 0;
    }
  }

  .left {
    width: 100%;
    display: flex;
    justify-content: flex-start;
  }
  .left .buttons {
    display: flex;
    flex-direction: row;
    margin-right: 0.5rem;
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

    svg {
      height: 100%;
      display: flex;
      align-items: center;
      width: 50%;
      justify-content: center;
    }

    input {
      opacity: 0;
      width: 0;
      height: 0;
    }
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
    padding: 0.5rem var(--padding, 1rem);

    .toolbar-link {
      margin: 0 0.5rem;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      color: var(--color-gray-1);
      text-decoration: underline transparent;
      
      &:hover {
        text-decoration-color: var(--primo-color-primored);

        svg {
          color: var(--primo-color-primored);
        }
      }

      span {
        margin-right: 2px;
      }

      svg {
        width: 0.65rem;
        height: 0.65rem;
        margin-left: 0.25rem;
      }
    }
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

  @media (max-width: 600px) {
    #primo-toolbar {
      background-color: var(--color-codeblack);

      .menu-container {
        flex-direction: column;
        justify-content: flex-start;
        background: var(--primo-color-codeblack);

        .left {
          align-items: center;
          background: var(--color-codeblack);

          .primary-buttons {
            justify-content: flex-start;
          }
        }
      }
    }
  }

  @media (min-width: 1024px) {
    .tooltip {
      display: block;
    }
  }

</style>
