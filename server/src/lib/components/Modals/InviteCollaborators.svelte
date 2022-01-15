<script>
  import { fade } from 'svelte/transition'
  import { createUniqueID } from '@primo-app/primo/src/utilities'
  import supabase from '../../../supabase/core'
  import { config, users } from '../../../supabase/db'
  import user from '../../../stores/user'

  let role = 'developer'

  const RoleLabel = (id) =>
    ({
      developer: 'Developer',
      content: 'Content Editor',
      admin: 'Owner',
    }[id])

  $: roleName = RoleLabel(role)

  let collaborators = []

  fetchServerUsers()
  supabase.from('users').on('*', fetchServerUsers).subscribe()
  async function fetchServerUsers() {
    const data = await users.get()
    collaborators = data
  }

  let key = ''
  config.get('invitation-key').then((res) => {
    key = res
    if (!key) resetKey()
  })

  $: link = `${window.location.href}?signup&role=${role}&key=${key}`

  async function resetKey() {
    key = createUniqueID(15)
    config.update('invitation-key', key)
    copied = false
  }

  let copied = false
  async function copyLink() {
    if (!navigator.clipboard) {
      alert(
        'Unable to copy item because your browser does not support copying. Please copy manually.'
      )
      return
    } else {
      copied = true
      await navigator.clipboard.writeText(link)
    }
  }

  async function updateUserRole(user) {
    if (user.role === 'remove') {
      users.delete(user.email)
    } else {
      users.update(user.email, {
        role: user.role,
      })
    }
  }
</script>

<main class="primo-modal primo-reset">
  <section>
    <h1>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"
        />
      </svg>
      <span>Invite</span>
    </h1>
    <h2>
      Send this private invitation link to invite a {roleName} to this server
    </h2>
    <div class="copy-link">
      <select bind:value={role}>
        <option value="developer" selected>Developer</option>
        <option value="content">Content Editor</option>
      </select>
      {#key key}
        <input in:fade readonly type="text" bind:value={link} />
      {/key}
      {#if !copied}
        <button on:click={copyLink}>Copy</button>
      {:else}
        <button disabled>Copied</button>
      {/if}
    </div>
    <div class="footer-text">
      <span>this invitation is only valid for a single user</span>
      <button on:click={resetKey}>Generate new link</button>
    </div>
  </section>
  <section>
    <h2>Existing Collaborators</h2>
    <ul>
      {#each collaborators as collaborator}
        <li in:fade>
          <div>
            <div
              class="profile"
              style="background-color: #{Math.floor(
                collaborator.email.length * 16777215
              ).toString(16)}"
            >
              <span>{collaborator.email.slice(0, 2)}</span>
            </div>
            <span>{collaborator.email}</span>
          </div>
          {#if $user.admin}
            <select
              bind:value={collaborator.role}
              disabled={collaborator.role === 'admin'}
              on:change={() => updateUserRole(collaborator)}
            >
              <option value="admin">Admin</option>
              <option value="developer" selected>Developer</option>
              <option value="content">Content Editor</option>
              <option disabled>───────</option>
              <option value="remove">Remove</option>
            </select>
          {:else}
            <span>
              {RoleLabel(collaborator.role)}
            </span>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
</main>

<style lang="postcss">
  .primo-modal {
    color: var(--color-gray-1);
    max-width: 40rem;
    display: grid;
    gap: 2rem;

    select {
      background: transparent;
      margin: 0 0.5rem;
    }

    h1 {
      display: flex;
      gap: 0.25rem;
      align-items: center;
      font-weight: 500;
      border-bottom: 1px solid #333;
      margin-bottom: 1.5rem;
      padding-bottom: 0.5rem;

      svg {
        width: 1rem;
        height: 1rem;
      }
    }

    h2 {
      padding-bottom: 0.75rem;
      font-weight: 500;
    }

    div.copy-link {
      background: #333;
      border-radius: 0.25rem;
      padding: 6px;
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.25rem;

      input {
        flex: 1;
        background: transparent;
        padding: 0 0.5rem;
        background: #4d4d4d;
        border-radius: 0.25rem;
      }

      button {
        padding: 0.5rem 1rem;
        background: var(--primo-color-primored);
        border-radius: 0.25rem;
        margin-left: 0.5rem;

        &:disabled {
          opacity: 0.5;
          pointer-events: none;
        }
      }
    }

    .footer-text {
      font-size: 0.75rem;
      display: flex;
      justify-content: space-between;
      padding-top: 0.25rem;

      button {
        text-decoration: underline;
      }
    }

    ul {
      display: grid;
      gap: 0.75rem;

      li {
        display: flex;
        justify-content: space-between;
        align-items: center;

        div {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .profile {
          background: red;
          border-radius: 50%;
          aspect-ratio: 1 / 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          text-transform: uppercase;
          width: 2.5rem;
        }

        select {
          text-align: right;
        }
      }
    }
  }
</style>
