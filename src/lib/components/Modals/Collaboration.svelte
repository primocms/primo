<script lang="ts">
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import CopyButton from '$lib/ui/CopyButton.svelte'
  import SplitButton from '$lib/editor/ui/inputs/SplitButton.svelte'
  import { createUniqueID } from '$lib/editor/utilities'
  import { sites, users } from '../../../supabase/db'
  import * as actions from '../../../actions'
  import user from '../../../stores/user'
  import { page } from '$app/stores'
  import Icon from '@iconify/svelte'

  export let site

  let role: string = 'developer'

  let password = site.password
  $: if (password) {
    showingLink = true
    createLink()
  }

  let loading: boolean = false

  let link

  let showingLink = false
  function showLink() {
    showingLink = true
    password = createUniqueID(15)
    createLink()
    savePass(password)
  }

  function createLink() {
    link = `https://${$page.url.host}/${site.id}?signup&role=${role}&password=${password}`
  }

  async function savePass(password) {
    sites.update(site.id, { password })
  }

  let collaborators = []

  $: if (site) setCollaborators()
  async function setCollaborators() {
    const allUsers = await users.get(null, '*', null)
    collaborators = allUsers
      .filter((u) => u.sites && u.sites.includes(site.id))
      .map((u) => ({
        ...u,
        created_at: u.created_at.substring(0, 7),
      }))
  }

  function removeCollaborator(collaborator) {
    collaborators = collaborators.filter((c) => c.id !== collaborator.id)
    actions.sites.removeUser({
      site,
      user: collaborator,
    })
  }
</script>

<main class="primo-modal">
  <h1 class="primo-heading-xl">Invite a collaborator to {site.name}</h1>
  {#if !loading}
    <div class="link-description">
      {#if showingLink}
        <div class="share-link">
          Share this link with one collaborator to give them access to this
          site.
        </div>
        <CopyButton label={link} />
      {:else}
        <form class="role-selection" on:submit|preventDefault={showLink}>
          <SplitButton
            bind:selected={role}
            buttons={[
              {
                id: 'developer',
                label: 'Developer',
              },
              {
                id: 'content',
                label: 'Content Editor',
              },
            ]}
          />
          <div class="description">
            {#if role === 'content'}
              <p>
                Content Editors write the site's content, lay out and build
                pages with component and content sections, and select design
                variations - all without seeing a line of code.
              </p>
            {:else if role === 'developer'}
              <p>
                Developers have full access to the site's code and content. They
                can create new components and connect fields that Content
                Editors can edit.
              </p>
            {/if}
          </div>
          <PrimaryButton type="submit" label="Create Link" />
        </form>
      {/if}
    </div>
  {/if}
  {#if collaborators.length > 0}
    <div class="collaborators">
      <header>
        <div>Email</div>
        <div>Role</div>
        <div>Created</div>
        <div>
          <Icon icon="heroicons-outline:user-remove" />
        </div>
      </header>
      <ul>
        {#each collaborators as collaborator}
          <li>
            <div>{collaborator.email}</div>
            <div>{collaborator.role}</div>
            <div>{collaborator.created_at}</div>
            <button on:click={() => removeCollaborator(collaborator)}>
              <Icon icon="akar-icons:circle-x" />
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</main>

<style lang="postcss">
  main {
    max-width: var(--primo-max-width-1);
  }

  .primo-heading-xl {
    font-weight: 600;
    font-size: 1.125rem;
  }

  .role-selection {
    --color-link: var(--primo-color-brand);
    --color-link-hover: var(--primo-color-brand-dark);
    margin: 1rem 0;

    --TextInput-mb: 1rem;

    .description {
      display: flex;
      margin-top: 1rem;
    }

    p {
      font-size: var(--primo-font-size-2);
      margin-bottom: 1rem;
    }
  }

  .collaborators {
    display: grid;
    margin-top: 2rem;

    header {
      font-weight: 600;
      display: grid;
      gap: 5px;
      grid-template-columns: 50% 1fr 1fr auto;
      border-bottom: 1px solid var(--color-gray-8);
      padding-bottom: 0.25rem;
      margin-bottom: 0.25rem;
    }

    ul {
      li {
        display: grid;
        grid-template-columns: 50% 1fr 1fr auto;
        gap: 5px;

        div {
          overflow: hidden;
        }

        &:not(:last-child) {
          margin-bottom: 0.5rem;
        }

        button:hover {
          color: red;
        }
      }
    }
  }

  .link-description {
    .share-link {
      font-weight: 600;
      margin: 1rem 0;
    }
  }
</style>
