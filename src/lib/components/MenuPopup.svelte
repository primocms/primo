<script>
  import _ from 'lodash-es'
  import { fade } from 'svelte/transition'
  import Icon from '@iconify/svelte'
  import { clickOutside } from '$lib/utils'
  import IconButton from '$lib/components/IconButton.svelte'
  // import { toast } from '@zerodevx/svelte-toast';

  export let options = []
  export let icon = 'carbon:overflow-menu-vertical'

  let showing_popup = false

  let active_submenu = null
  let selected_submenu_option = null
</script>

<div
  class="MenuPopup"
  use:clickOutside
  on:click_outside={() => (showing_popup = false)}
>
  <IconButton {icon} on:click={() => (showing_popup = !showing_popup)} />
  {#if showing_popup}
    <div class="popup" in:fade={{ duration: 100 }}>
      {#if !active_submenu}
        <div class="options">
          {#each options as { on_click, icon, label, submenu }}
            {#if label === 'DIVIDER'}
              <hr />
            {:else if label}
              <button
                on:click={(e) => {
                  if (on_click) {
                    showing_popup = false
                    on_click(e)
                  } else if (submenu) {
                    active_submenu = submenu
                  }
                }}
              >
                <Icon {icon} />
                <span>{label}</span>
              </button>
            {/if}
          {/each}
        </div>
      {:else if active_submenu}
        {@const { title, options, button } = active_submenu}
        <div class="submenu" in:fade={{ duration: 100 }}>
          <header>
            <span>{title}</span>
            <button
              on:click={() => {
                active_submenu = null
                selected_submenu_option = null
              }}
            >
              <Icon icon="carbon:close" />
            </button>
          </header>
          <div class="suboptions">
            {#each options as option}
              <button
                class:selected={selected_submenu_option?.id === option.id}
                on:click={() => (selected_submenu_option = option)}
                >{option.label}</button
              >
            {/each}
          </div>
          {#if button}
            <footer>
              <button
                disabled={!selected_submenu_option}
                on:click={() => {
                  button.on_click(selected_submenu_option)
                  // if (button.toast) {
                  // 	toast.push(button.toast(selected_submenu_option));
                  // }
                  showing_popup = false
                  selected_submenu_option = null
                }}>{button.label}</button
              >
            </footer>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="postcss">
  .MenuPopup {
    /* font-size: 1.25rem; */
    position: relative;
    opacity: var(--MenuPopup-opacity, 1);
  }
  .popup {
    display: grid;
    gap: 0.375rem;
    place-items: normal;
    padding: 0.25rem;
    font-size: 0.75rem;
    border-radius: 0.25rem;
    position: absolute;
    right: 0;
    top: 25px;
    background: #171717;
    border: 1px solid #292929;
    z-index: 1;

    .options {
      hr {
        margin-block: 0.25rem;
      }
    }

    button {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      border-radius: 0.25rem;
      padding: 0.25rem 0.5rem;
      width: 100%;
      text-align: left;
      white-space: nowrap;

      &:hover {
        background: #292929;
      }
    }
  }
  .submenu {
    header {
      white-space: nowrap;
      display: flex;
      gap: 1rem;
      margin-bottom: 0.25rem;

      span {
        font-weight: 500;
      }

      button {
        padding: 0.25rem;
      }
    }
    .suboptions {
      button.selected {
        color: #1d5ffc;
        background: #1d5ffc19;
      }
    }
    footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 0.25rem;

      button {
        width: initial;
        color: white !important;
        background: #1d5ffc !important;

        &[disabled] {
          color: #b8bcc7 !important;
          background: #1d5ffc0c !important;
        }
      }
    }
  }
</style>
