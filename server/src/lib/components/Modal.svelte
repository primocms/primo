<script context="module">
  import { writable } from 'svelte/store'

  const defaultValue = {
    id: null,
    props: {},
    options: {
      disableClose: false,
    },
  }

  export const type = writable(defaultValue)

  export const visible = writable(false)

  export function show(t) {
    if (typeof t === 'string') {
      type.set({
        ...defaultValue,
        id: t,
      })
    } else {
      type.set(t)
    }
    visible.set(true)
  }

  export function hide() {
    type.set(defaultValue)
    visible.set(false)
  }
</script>

<script>
  import { fade } from 'svelte/transition'
  import CreateSite from './Modals/CreateSite.svelte'
  import UserSettings from './Modals/UserSettings.svelte'
  import Authentication from './Modals/Authentication.svelte'
  import Collaboration from './Modals/Collaboration.svelte'
  import InviteCollaborators from './Modals/InviteCollaborators.svelte'

  const modals = {
    AUTH: Authentication,
    SITE_CREATION: CreateSite,
    USER_SETTINGS: UserSettings,
    COLLABORATION: Collaboration,
    INVITE_COLLABORATORS: InviteCollaborators,
  }

  let activeModal = modals[$type.id]
  $: showModal($type.id)
  async function showModal(typeID) {
    const modal = modals[typeID]
    activeModal = modals[typeID]
  }

  async function hideModal() {
    if ($type.options?.disableClose) return
    $visible = false
  }
</script>

{#if $visible}
  <div class="modal mousetrap primo-reset" transition:fade={{ duration: 100 }}>
    <div
      class="modal-background"
      on:click={hideModal}
      class:disabled={$type.options?.disableClose}
    />
    <div class="modal-card">
      <div class="modal-card-body">
        <svelte:component this={activeModal} {...$type.props} />
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .modal {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: fixed;
    z-index: 9999999999;
    inset: 0;
  }

  .modal-background {
    inset: 0;
    position: absolute;
    background: var(--primo-color-black);
    opacity: 0.95;
    cursor: pointer;
    transition: opacity 0.1s;

    &:hover {
      opacity: 0.9;
    }

    &.disabled {
      cursor: default;

      &:hover {
        opacity: 0.95;
      }
    }
  }

  .modal-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 0 auto;
    position: relative;
    border-radius: var(--primo-border-radius);
    max-height: calc(100vh - 2rem);
  }

  .modal-card-body {
    flex: 1;
    overflow-y: scroll;
  }
</style>
