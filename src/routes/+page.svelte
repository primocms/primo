<script>
  import { tick, getContext } from 'svelte'
  import Icon from '@iconify/svelte'
  import { page } from '$app/stores'
  import DashboardToolbar from '$lib/components/DashboardToolbar.svelte'
  import SiteThumbnail from '$lib/components/SiteThumbnail.svelte'
  import { show, hide } from '$lib/components/Modal.svelte'
  import * as actions from '$lib/actions'
  import { invalidate } from '$app/navigation'

  /** @type {{
   sites: Array<import('$lib').Site>
   session: any
   user: import('$lib').User
   config: any
  }} */
  export let data

  function beginInvitation(site) {
    show({
      id: 'INVITE_SITE_COLLABORATOR',
      props: {
        site,
      },
    })
  }

  let loading
  function createSite() {
    show({
      id: 'CREATE_SITE',
      props: {
        onSuccess: async (site, preview) => {
          await actions.sites.create(site, preview)
          invalidate('app:data')
          hide()
        },
      },
    })
  }

  async function delete_site(site) {
    show({
      id: 'DELETE_SITE',
      props: {
        site,
      },
    })
  }

  async function rename_site(id, name) {
    await actions.sites.update(id, { name })
  }

  let siteBeingEdited = { id: null, element: null }
</script>

<main class="primo-reset">
  <div class="container">
    <DashboardToolbar />
    <div class="sites-container">
      <ul class="sites">
        {#each data.sites as site, i (site.id)}
          <li>
            <a class="site-link" href={site.url}>
              <SiteThumbnail {site} />
            </a>
            <div class="site-info">
              <div class="site-name">
                {#if siteBeingEdited.id === site.id}
                  <form
                    on:submit|preventDefault={() => (siteBeingEdited = { id: null, element: null })}
                  >
                    <input
                      bind:this={siteBeingEdited.element}
                      on:blur={() => rename_site(site.id, site.name)}
                      class="reset-input"
                      type="text"
                      bind:value={site.name}
                    />
                  </form>
                {:else}
                  <a data-sveltekit-prefetch href={site.url}>
                    <span>{site.name}</span>
                    <Icon icon="ic:round-chevron-right" />
                  </a>
                {/if}
              </div>
              <span class="site-url">{site.url}</span>
              {#if getContext('DEBUGGING')}
                <button
                  style="font-size:0.75rem;cursor:pointer;text-align:left"
                  on:click={(e) => {
                    navigator.clipboard.writeText(e.target.innerText)
                    e.target.style.opacity = '0.5'
                  }}
                >
                  {site.id}
                </button>
              {/if}
              {#if $page.data.user.admin}
                <div class="buttons">
                  <button on:click={() => beginInvitation(site)} class="site-button">
                    <Icon icon="clarity:users-solid" />
                    <span>Collaborators</span>
                  </button>
                  <button
                    class="site-button"
                    on:click={async () => {
                      siteBeingEdited = { id: site.id, element: null }
                      await tick()
                      siteBeingEdited.element.focus()
                    }}
                  >
                    <Icon icon="material-symbols:edit-square-outline-rounded" />
                    <span>Rename</span>
                  </button>
                  <button class="site-button" on:click={() => delete_site(site)}>
                    <Icon icon="pepicons-pop:trash" />
                    <span>Delete</span>
                  </button>
                </div>
              {/if}
            </div>
          </li>
        {/each}
        {#if data.user.server_member}
          <li>
            <button class="create-site" on:click={createSite}>
              {#if loading}
                <div class="icon">
                  <Icon icon="eos-icons:loading" />
                </div>
              {:else}
                <div class="icon">
                  <Icon icon="ic:round-plus" />
                </div>
              {/if}
              Create a site
            </button>
          </li>
        {/if}
      </ul>
    </div>
  </div>
</main>

<style lang="postcss">
  main {
    background-color: var(--primo-color-black);
    min-height: 100vh;
    position: relative;
    z-index: 0;

    .container {
      display: flex;
      flex-direction: column;
      border-radius: var(--primo-border-radius);
      margin: 0 auto;
      padding: 1rem 2rem;
      min-height: 100vh;
    }

    .sites-container {
      display: grid;
      gap: 1rem;

      header {
        a {
          text-decoration: underline;
          color: var(--color-gray-4);
        }
      }

      ul.sites {
        display: grid;
        gap: 1rem;

        li {
          background: var(--color-gray-9);
          border-radius: var(--primo-border-radius);
          overflow: hidden;
          font-size: var(--font-size-4);
          transition: 0.1s box-shadow;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          transition: 0.1s box-shadow;

          &:has(a:hover) {
            box-shadow: var(--primo-ring-brand-thick);

            & ~ li:last-child {
              box-shadow: var(--primo-ring-brand-thin);
            }
          }

          &:last-child {
            box-shadow: var(--primo-ring-brand);
          }

          .site-link {
            overflow: hidden;
            max-height: 16vw;
            flex: 1;
            background: var(--color-gray-8);
            transition: opacity 0.1s;
          }

          .site-info {
            color: var(--color-gray-1);
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            padding: 1.5rem;

            .site-name {
              form {
                line-height: 0;
              }
              a {
                display: flex;
                justify-content: space-between;

                &:hover {
                  color: var(--primo-color-brand);
                }
              }

              a,
              input {
                text-align: left;
                font-size: 1.125rem;
                font-weight: 500;
              }

              button {
                border-radius: var(--primo-border-radius);
                padding: 0 0.5rem;

                &:hover {
                  color: var(--primo-color-brand);
                }
              }
            }

            .site-url {
              grid-column: 1;
              margin-bottom: 0.5rem;
              font-size: var(--font-size-1);
              color: var(--color-gray-4);
            }

            .buttons {
              grid-column: 1;
              display: flex;
              align-items: center;
              color: var(--color-gray-3);
              margin-top: 0.5rem;

              button {
                margin-right: 0.75rem;

                span {
                  margin-left: 0.25rem;
                }
              }
            }
          }
        }
        .icon {
          font-size: 1.5rem;
        }
        button.create-site {
          padding: 3rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: var(--primo-color-black);
          font-weight: 400;
          font-size: 1.125rem;
          color: var(--color-gray-2);

          &:active {
            background: var(--primo-color-brand);
            color: var(--primo-color-black);
          }
        }
      }
    }
  }

  .site-button {
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    color: var(--color-gray-2);
    text-decoration: underline;
    text-align: left;
    &:hover {
      color: var(--primo-color-brand);
    }
  }

  button {
    transition:
      color 0.1s,
      background-color 0.1s;
    &:focus {
      outline: 2px solid var(--primo-color-brand);
    }
    &:disabled {
      opacity: 0.5;
      pointer-events: none;
    }
  }

  .reset-input {
    border: none;
    background-image: none;
    background-color: transparent;
    box-shadow: none;
    background: transparent;
    border: 0;
    padding: 0;
    margin: 0;

    &:focus {
      outline: 0;
    }
  }

  @media (min-width: 600px) {
    main .sites-container ul.sites {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (min-width: 900px) {
    main .sites-container ul.sites {
      grid-template-columns: 1fr 1fr 1fr;
    }
  }

  @media (min-width: 1200px) {
    main .sites-container ul.sites {
      grid-template-columns: 1fr 1fr 1fr 1fr;
    }
  }
</style>
