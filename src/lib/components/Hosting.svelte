<script>
  import axios from 'axios'
  import Icon from '@iconify/svelte'
  import { find as _find, flattenDeep } from 'lodash-es'
  import { fade, slide } from 'svelte/transition'
  import hosts from '../../stores/hosts'
  import * as actions from '../../actions'
  import TextField from '$lib/ui/TextField.svelte'
  import { id as siteID, site, repo } from '$lib/editor/stores/data/draft'
  import { active_site } from '$lib/editor/stores/actions'
  import { supabase } from '$lib/supabase'

  async function connectGithub(token) {
    const headers = { Authorization: `Bearer ${token}` }

    const { data } = await axios.get(`https://api.github.com/user`, {
      headers: { ...headers, Accept: 'application/vnd.github.v3+json' },
    })

    if (data) {
      actions.github_token.set(token)
      // actions.hosts.create({
      //   name: 'github',
      //   token,
      //   user: data,
      // })
      // actions.sites.update({
      //   id: $siteID,
      //   props: {
      //     host: 'github',
      //   },
      // })
    }
  }

  let showingHosts = true
  let errorMessage = null

  let connecting_host = null

  const availableHosts = [
    {
      id: 'github',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" id="footer-sample-full" width="3.69em" height="1em" preserveAspectRatio="xMidYMid meet" viewBox="0 0 512 139" class="iconify iconify--logos"><path fill="currentColor" d="M98.696 59.312h-43.06a2.015 2.015 0 0 0-2.013 2.014v21.053c0 1.111.902 2.015 2.012 2.015h16.799v26.157s-3.772 1.286-14.2 1.286c-12.303 0-29.49-4.496-29.49-42.288c0-37.8 17.897-42.773 34.698-42.773c14.543 0 20.809 2.56 24.795 3.794c1.253.384 2.412-.863 2.412-1.975l4.803-20.342c0-.52-.176-1.146-.769-1.571C93.064 5.527 83.187 0 58.233 0C29.488 0 0 12.23 0 71.023c0 58.795 33.76 67.556 62.21 67.556c23.555 0 37.844-10.066 37.844-10.066c.59-.325.653-1.148.653-1.526V61.326c0-1.11-.9-2.014-2.01-2.014Zm221.8-51.953c0-1.12-.888-2.024-1.999-2.024h-24.246a2.016 2.016 0 0 0-2.008 2.024l.006 46.856h-37.792V7.36c0-1.12-.892-2.024-2.001-2.024H228.21a2.014 2.014 0 0 0-2.003 2.024v126.872c0 1.12.9 2.03 2.003 2.03h24.245c1.109 0 2-.91 2-2.03V79.964h37.793l-.066 54.267c0 1.12.9 2.03 2.008 2.03h24.304c1.11 0 1.998-.91 2-2.03V7.36ZM144.37 24.322c0-8.73-7-15.786-15.635-15.786c-8.627 0-15.632 7.055-15.632 15.786c0 8.72 7.005 15.795 15.632 15.795c8.635 0 15.635-7.075 15.635-15.795Zm-1.924 83.212V48.97a2.015 2.015 0 0 0-2.006-2.021h-24.169c-1.109 0-2.1 1.144-2.1 2.256v83.905c0 2.466 1.536 3.199 3.525 3.199h21.775c2.39 0 2.975-1.173 2.975-3.239v-25.536ZM413.162 46.95h-24.06c-1.104 0-2.002.909-2.002 2.028v62.21s-6.112 4.472-14.788 4.472c-8.675 0-10.977-3.937-10.977-12.431v-54.25c0-1.12-.897-2.03-2.001-2.03h-24.419c-1.102 0-2.005.91-2.005 2.03v58.358c0 25.23 14.063 31.403 33.408 31.403c15.87 0 28.665-8.767 28.665-8.767s.61 4.62.885 5.168c.276.547.994 1.098 1.77 1.098l15.535-.068c1.102 0 2.005-.911 2.005-2.025l-.008-85.168a2.02 2.02 0 0 0-2.008-2.028Zm55.435 68.758c-8.345-.254-14.006-4.041-14.006-4.041V71.488s5.585-3.423 12.436-4.035c8.664-.776 17.013 1.841 17.013 22.51c0 21.795-3.768 26.096-15.443 25.744Zm9.49-71.483c-13.665 0-22.96 6.097-22.96 6.097V7.359a2.01 2.01 0 0 0-2-2.024h-24.315a2.013 2.013 0 0 0-2.004 2.024v126.872c0 1.12.898 2.03 2.007 2.03h16.87c.76 0 1.335-.39 1.76-1.077c.419-.682 1.024-5.85 1.024-5.85s9.942 9.422 28.763 9.422c22.096 0 34.768-11.208 34.768-50.315s-20.238-44.217-33.913-44.217ZM212.229 46.73h-18.187l-.028-24.027c0-.909-.468-1.364-1.52-1.364H167.71c-.964 0-1.481.424-1.481 1.35v24.83s-12.42 2.998-13.26 3.24a2.013 2.013 0 0 0-1.452 1.934v15.603c0 1.122.896 2.027 2.005 2.027h12.707v37.536c0 27.88 19.556 30.619 32.753 30.619c6.03 0 13.243-1.937 14.434-2.376c.72-.265 1.138-1.01 1.138-1.82l.02-17.164c0-1.119-.945-2.025-2.01-2.025c-1.06 0-3.77.431-6.562.431c-8.933 0-11.96-4.154-11.96-9.53l-.001-35.67h18.188a2.014 2.014 0 0 0 2.006-2.028V48.753c0-1.12-.897-2.022-2.006-2.022Z"></path></svg>`,
    },
  ]

  let enteredToken
</script>

<div class="boxes">
  {#if $repo}
    <div class="box host-account">
      <div class="user">
        <Icon icon="mdi:github" />
      </div>
      <div class="remove-option">
        <button
          on:click={() => {
            actions.hosts.delete(host.name)
          }}>Remove</button
        >
      </div>
    </div>
  {/if}

  {#if connecting_host}
    <div class="box connecting-host">
      <button class="back" on:click={() => (connecting_host = null)}
        >Back to web hosts</button
      >
      <form
        on:submit|preventDefault={async () => {
          await connectGithub(enteredToken)
          connecting_host = null
        }}
        in:fade={{ duration: 200 }}
      >
        <TextField
          bind:value={enteredToken}
          on:change={() => {
            connectGithub(enteredToken)
            connecting_host = null
          }}
          placeholder="7diizPFerd0Isu33ex9aamjT"
          button={{
            label: 'Connect',
            type: 'submit',
          }}
        >
          <p class="title">Github</p>
          <p class="subtitle">
            Create and enter a <a
              style="text-decoration:underline"
              target="blank"
              href="https://github.com/settings/tokens">Personal Access Token</a
            > to finish connecting to your account
          </p>
        </TextField>
        {#if errorMessage}
          <div class="error-message" transition:slide>
            {errorMessage}
          </div>
        {/if}
      </form>
    </div>
  {/if}
  {#if showingHosts && !connecting_host}
    <div class="hosts">
      <div class="buttons" in:fade={{ duration: 200 }}>
        {#each availableHosts as host}
          <button
            class="button {host.id}"
            on:click={() => (connecting_host = true)}
          >
            {@html host.svg}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .link {
    font-size: 0.85rem;
    color: var(--primo-color-gray-4);
    transition: text-decoration-color 0.1s, color 0.1s;
    text-decoration: underline var(--primo-color-gray-4);
    &:hover {
      text-decoration-color: var(--primo-color-brand);
      color: var(--primo-color-brand);
    }
  }
  .heading {
    margin-bottom: 1rem;
    font-size: 0.75rem;
    color: var(--primo-color-gray-4);
  }
  .title {
    margin-bottom: 0.25rem;
    color: var(--primo-color-gray-1);
    font-weight: 600;
  }

  .subtitle {
    color: var(--primo-color-gray-2);
    margin-bottom: 1rem;
    font-size: var(--font-size-2);
    line-height: 1.5;
    a {
      text-decoration: underline;
      &:hover {
        color: var(--primo-color-brand);
      }
    }
  }

  .box {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 1rem;
    background: var(--primo-color-codeblack);
    .icon-item {
      a {
        text-decoration: underline;
      }
    }
    .user {
      display: grid;
      grid-template-columns: auto 1fr;
      place-items: center;
      gap: 1rem;
    }
    a {
      text-decoration: underline;
    }
    &.host-account {
      width: 100%;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      transition: box-shadow 0.1s;
      border-radius: var(--primo-border-radius);
      margin-bottom: 0.5rem;

      &:hover {
        /* box-shadow: var(--primo-ring-brand); */
      }
      &:not(:last-child) {
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--primo-color-gray-9);
        margin-bottom: 1rem;
      }

      .remove-option button {
        padding: 0.5rem 1rem;
        border: 1px solid var(--color-gray-8);
        border-radius: var(--primo-border-radius);
      }
    }
    /* .deployment {
      display: flex;
      flex-direction: column;

      span:last-child {
        font-size: 0.75rem;
        color: var(--primo-color-gray-3);
      }
    } */
  }

  .boxes {
    display: grid;
    gap: 1rem;

    footer {
      display: flex;
      gap: 1rem;
      text-align: right;
    }
  }

  .buttons {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 1fr 1fr;
    color: black;

    .button {
      background: white;
      padding: 1rem;
      box-shadow: 0 0 0 0 var(--primo-color-brand);
      border-radius: var(--primo-border-radius);
      transition: box-shadow 0.1s;
      overflow: visible;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      &:not([disabled]):hover {
        box-shadow: 0 0 0 3px var(--primo-color-brand);
      }
    }

    .button.github {
      padding: 2rem 0;
    }
  }

  .connecting-host {
    padding: 1rem;
    box-shadow: 0 0 0 1px var(--primo-color-brand);
    margin-top: 1rem;
    width: 100%;
    --space-y: 0;

    .back {
      color: var(--primo-color-brand);
      font-size: 0.75rem;
      text-decoration: underline;
      margin-bottom: 0.5rem;
    }
  }
</style>
