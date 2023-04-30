<script>
  import axios from 'axios'
  import * as timeago from 'timeago.js'
  import { page } from '$app/stores'
  import { supabase, create_row } from '$lib/supabase'

  export let site

  const owner = $page.data.session.user

  let loading = false
  let email = ''
  let role = 'DEV'

  async function invite_editor() {
    loading = true
    await create_row('invitations', {
      email,
      inviter_email: owner.email,
      site: site.id,
      role,
    })
    const { data: success } = await axios.post('/api/invitations', {
      site: site.id,
      email,
      role,
      server_invitation: false,
      url: $page.url.origin,
    })
    if (success) {
      const { data, error } = await supabase
        .from('invitations')
        .select('*')
        .eq('site', site.id)
      if (data) {
        invitations = data
      }
    } else {
      alert('Could not send invitation. Please try again.')
    }
    email = ''
    loading = false
  }

  let editors = []
  get_collaborators(site.id).then((res) => {
    editors = res
  })

  let invitations = []
  get_invitations(site.id).then((res) => {
    invitations = res
  })

  async function get_invitations(site_id) {
    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('site', site_id)
    return data || []
  }

  export async function get_collaborators(site_id) {
    const { data, error } = await supabase
      .from('collaborators')
      .select(`user (*)`)
      .filter('site', 'eq', site_id)
    if (error) {
      console.error(error)
      return []
    } else return data.map((item) => item.user)
  }
</script>

<div class="Invitation">
  <main>
    <h2>Invite site collaborator</h2>
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
            <option value="DEV">Developer</option>
            <option value="EDITOR">Content Editor</option>
          </select>
        </div>
        <button type="submit">Send invite</button>
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
        <li>
          <span class="letter">{owner.email[0]}</span>
          <span class="email">{owner.email}</span>
          <span class="role">Owner</span>
        </li>
        {#each editors as { email }}
          <li>
            <span class="letter">{email[0]}</span>
            <span class="email">{email}</span>
            <span class="role">Editor</span>
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
  }
  h2 {
    font-weight: 700;
    font-size: 1rem;
  }
  .subheading {
    font-weight: 700;
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
  }
  form {
    display: grid;
    gap: 0.25rem;

    div {
      display: flex;
      gap: 0.5rem;
      font-size: 0.75rem;

      .input-group {
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
