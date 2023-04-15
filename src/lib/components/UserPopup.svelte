<script>
  import _ from 'lodash-es'
  import { fade } from 'svelte/transition'
  import Icon from '@iconify/svelte'
  import { clickOutside } from '$lib/utils'
  // import { toast } from '@zerodevx/svelte-toast';
  import Letter from '$lib/ui/Letter.svelte'
  import { page } from '$app/stores'
  import { sign_out } from '$lib/supabase'

  let showing_popup = false
</script>

<div
  class="MenuPopup"
  use:clickOutside
  on:click_outside={() => (showing_popup = false)}
>
  <button class="open-popup" on:click={() => (showing_popup = !showing_popup)}>
    <Letter letter={$page.data.user.email.slice(0, 1)} />
    <Icon icon="mdi:chevron-down" />
  </button>

  {#if showing_popup}
    <div class="popup" in:fade={{ duration: 100 }}>
      <div class="row">
        <Letter letter={$page.data.user.email.slice(0, 1)} />
        <span>{$page.data.user.email}</span>
      </div>
      <hr />
      <button class="row" on:click={sign_out}>
        <Icon icon="mdi:sign-out" />
        <span>Sign Out</span>
      </button>
    </div>
  {/if}
</div>

<style lang="postcss">
  .MenuPopup {
    /* font-size: 1.25rem; */
    position: relative;
    opacity: var(--MenuPopup-opacity, 1);
  }
  button.open-popup {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .popup {
    padding: 12px;
    display: grid;
    gap: 0.375rem;
    place-items: normal;
    font-size: 0.75rem;
    border-radius: 0.25rem;
    position: absolute;
    right: 0;
    top: 39px;
    background: #171717;
    border: 1px solid #292929;
    z-index: 99;

    hr {
      border-color: #222;
      margin: 0.25rem 0;
      transform: scale(1.05);
    }

    .row {
      display: flex;
      align-items: center;
      gap: 0.25rem;
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
