<script>
  import axios from 'axios'
  import Icon from '@iconify/svelte'
  import * as timeago from 'timeago.js'
  import { page } from '$app/stores'

  const { supabase } = $page.data

  let loading = false
  let email = ''
  let role = 'DEV'

  async function invite_editor() {
    loading = true
    await supabase.from('invitations').insert({
      email,
      inviter_email: $page.data.user.email,
      role,
      server_invitation: true,
    })
    const { data } = await axios.post('/api/invitations', {
      url: $page.url.origin,
      email,
      role,
      server_invitation: true,
    })

    if (data.success) {
      invitations = await get_invitations()
    } else {
      alert(data.error)
    }
    loading = false
    email = ''
  }

  let editors = []
  let invitations = []

  get_collaborators().then((res) => {
    editors = res
  })
  get_invitations().then((res) => {
    invitations = res
  })

  async function get_invitations() {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('server_invitation', true)
    return data || []
  }

  export async function get_collaborators() {
    const { data, error } = await supabase
      .from('server_members')
      .select('*, user(*)')
    if (error) {
      console.error(error)
      return []
    } else return data
  }

  const Role = (role) =>
    ({
      DEV: 'Developer',
      EDITOR: 'Content Editor',
    }[role])
</script>

<div class="Invitation">
  <main>
    <header>
      <h2>Invite Server Member</h2>
      <h3>
        Server members have access to all the sites on this server and can
        create new sites.
      </h3>
    </header>
    <form on:submit|preventDefault={invite_editor}>
      <label class="subheading" for="email">Enter collaborator email</label>
      <div>
        <div class="input-group">
          <input
            bind:value={email}
            type="text"
            placeholder="Email address"
            name="email"
          />
          <select bind:value={role}>
            <option value="DEV">{Role('DEV')}</option>
            <option value="EDITOR">{Role('EDITOR')}</option>
          </select>
        </div>
        <button type="submit" disabled={!email}>
          {#if loading}
            <Icon icon="eos-icons:loading" />
          {:else}
            <span>Send invite</span>
          {/if}
        </button>
      </div>
    </form>
    {#if invitations.length > 0}
      <section>
        <h3 class="subheading">Invitations</h3>
        <ul>
          {#each invitations.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) as { email, created_at }}
            <li>
              <span class="letter">{email[0]}</span>
              <span class="email">{email}</span>
              <span>Sent {timeago.format(created_at)}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
    <section>
      <h3 class="subheading">People with Access</h3>
      <ul>
        {#each editors as { user, role }}
          <li>
            <span class="letter">{user.email[0]}</span>
            <span class="email">{user.email}</span>
            <span class="role">{Role(role)}</span>
          </li>
        {/each}
      </ul>
    </section>
  </main>
</div>

<style lang="postcss">
  .Invitation {
    /* --Modal-max-width: 450px; */
    /* --Modal-padding: 1rem 1.5rem; */
    --Modal-align-items: center;
    padding: 1rem 1.5rem;
    color: var(--color-gray-1);
  }
  main {
    display: grid;
    gap: 1.5rem;
    max-width: 450px;
  }
  header {
    h2 {
      font-weight: 700;
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }
    h3 {
      font-size: 0.875rem;
      color: var(--color-gray-2);
    }
  }
  .subheading {
    font-weight: 700;
    font-size: 0.75rem;
  }
  form {
    display: grid;
    gap: 0.25rem;
    flex: 1;

    div {
      display: flex;
      gap: 0.5rem;
      font-size: 0.75rem;

      .input-group {
        flex: 1;
        border-radius: 4px;
        border: 1px solid #eee;
        color: var(--color-gray-2);
      }

      input {
        flex: 1;
        padding: 0.25rem 0.5rem;
        border-right: 1px solid var(--color-gray-8);
        background: transparent;
      }

      select {
        background: transparent;
      }

      button {
        padding: 10px 12px;
        background: var(--color-gray-7);
        border-radius: 4px;

        &:disabled {
          opacity: 0.5;
        }
      }
    }
  }
  ul {
    margin-top: 0.5rem;
    display: grid;
    gap: 0.75rem;
  }
  li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 400;
    font-size: 0.75rem;
    /* color: #3a3d45; */
    .letter {
      height: 26px;
      width: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #81a6fd;
      color: white;
      font-weight: 700;
      font-size: 0.875rem;
      line-height: 0;
      border-radius: 50%;
    }
    .email {
      flex: 1;
    }
  }
</style>
