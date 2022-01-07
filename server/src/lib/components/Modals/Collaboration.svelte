<script lang="ts">
  import { fade } from 'svelte/transition'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import CopyButton from '$lib/ui/CopyButton.svelte'
  import SplitButton from '@primo-app/primo/src/ui/inputs/SplitButton.svelte'
  import { createUniqueID } from '@primo-app/primo/src/utilities'
  import { sites } from '../../../supabase/db'
  import user from '../../../stores/user'
  import { page } from '$app/stores'

  export let site

  let role: string = 'developer'

  let password = site.password
  $: if (password) {
    showingLink = true
    createLink()
  }

  let loading: boolean = false

  let link
  let copied

  let showingLink = false
  function showLink() {
    showingLink = true
    password = createUniqueID(15)
    createLink()
    savePass(password)
  }

  function createLink() {
    link = `https://${$page.host}/${site.id}?role=${role}&password=${password}`
  }

  async function savePass(password) {
    await sites.update(site.id, { password })
  }
</script>

<main class="primo-modal">
  <h1 class="primo-heading-xl">Invite a collaborator to {site.name}</h1>
  {#if !loading}
    <div class="link-description">
      {#if showingLink}
        <div class="share-link">
          Anybody with this <strong>secret link</strong> will be able to publish
          changes to your site.
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
                Content Editors only have access to the site's content, so
                they'll never accidentally run into its code and break
                something.
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
</main>

<style lang="postcss">
  main {
    max-width: var(--primo-max-width-1);
  }

  .role-selection {
    --color-link: var(--primo-color-primored);
    --color-link-hover: var(--primo-color-primored-dark);
    margin: 1rem 0;

    --TextInput-mb: 1rem;

    .subheading {
      font-size: 1rem;
      font-weight: 600;
      padding-bottom: 0.25rem;
    }

    .description {
      display: flex;
      margin-top: 1rem;
    }

    p {
      font-size: var(--primo-font-size-2);
      margin-bottom: 1rem;
    }
  }

  .link-description {
    .share-link {
      margin: 1rem 0;
    }
  }
</style>
