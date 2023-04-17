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
    <Icon icon="mdi:chevron-{showing_popup ? 'up' : 'down'}" />
  </button>

  {#if showing_popup}
    <div class="popup" in:fade={{ duration: 100 }}>
      <div class="row">
        <Letter letter={$page.data.user.email.slice(0, 1)} />
        <span class="email">{$page.data.user.email}</span>
      </div>
      <hr />
      <button class="row" on:click={sign_out}>
        <div class="icon"><Icon icon="mdi:sign-out" /></div>
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
    padding: 14px;
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
    min-width: 190px;

    .email {
      font-size: 14px;
    }

    hr {
      border-color: #222;
      margin: 0.25rem 0;
      transform: scale(1.08);
      transform-origin: center;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .icon {
      font-size: 1.125rem;
    }

    button {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      border-radius: 0.25rem;
      padding: 0.5rem 0.75rem;
      width: 100%;
      text-align: left;
      white-space: nowrap;
      font-size: 14px;

      &:hover {
        background: #292929;
      }
    }
  }
</style>
