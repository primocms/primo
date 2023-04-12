<script lang="ts">
  import Icon from '@iconify/svelte'
  import { page } from '$app/stores'
  import DashboardToolbar from '$lib/components/DashboardToolbar.svelte'
  import SiteFooter from '$lib/components/SiteFooter.svelte'
  import SiteThumbnail from '$lib/components/SiteThumbnail.svelte'
  import Modal, { show, hide } from '$lib/components/Modal.svelte'
  import user from '../stores/user'
  import * as actions from '../actions'
  import { invalidate } from '$app/navigation'

  export let data

  if (data) actions.setCustomization(data, false)

  function beginInvitation(site): void {
    show({
      id: 'INVITE_SITE_COLLABORATOR',
      props: {
        site,
      },
    })
  }

  let loading
  function createSite(): void {
    show({
      id: 'CREATE_SITE',
      props: {
        onSuccess: async (site) => {
          await actions.sites.create(site)
          invalidate('app:data')
          hide()
        },
      },
    })
  }

  async function delete_site(siteID: string): Promise<any> {
    const confirm = window.confirm(
      `Are you sure you want to delete this site? You won't be able to get it back.`
    )
    if (!confirm) return
    await actions.sites.delete(siteID)
    invalidate('app:data')
  }

  async function editSite(site) {
    actions.sites.update({
      id: site.id,
      props: {
        name: site.name,
      },
    })
  }

  let siteBeingEdited
</script>

<main class="primo-reset">
  {#if $user.signedIn}
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
                  {#if siteBeingEdited === site.id}
                    <form
                      on:submit|preventDefault={() => (siteBeingEdited = null)}
                    >
                      <input
                        on:blur={() => (siteBeingEdited = null)}
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
                {#if $page.data.user.admin}
                  <div class="buttons">
                    <button
                      on:click={() => beginInvitation(site)}
                      class="site-button"
                    >
                      <Icon icon="clarity:users-solid" />
                      <span>Site Members</span>
                    </button>
                    <button
                      class="site-button"
                      on:click={() => (siteBeingEdited = site.id)}
                    >
                      <Icon
                        icon="material-symbols:edit-square-outline-rounded"
                      />
                      <span>Rename</span>
                    </button>
                    <button
                      class="site-button"
                      on:click={() => delete_site(site.id)}
                    >
                      <Icon icon="pepicons-pop:trash" />
                      <span>Delete</span>
                    </button>
                  </div>
                {/if}
              </div>
            </li>
          {/each}
          {#if $page.data.user.server_member}
            <li>
              <button class="create-site" on:click={createSite}>
                {#if loading}
                  <!-- <Spinner /> -->§
                {:else}
                  <Icon icon="ic:round-plus" />
                {/if}
                create a site
              </button>
            </li>
          {/if}
        </ul>
      </div>
      <SiteFooter />
    </div>
  {/if}
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
                font-size: var(--font-size-4);
                font-weight: 600;
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

        button.create-site {
          padding: 3rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: var(--primo-color-black);
          font-weight: 600;
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
    &:hover {
      color: var(--primo-color-brand);
    }
  }

  button {
    transition: color 0.1s, background-color 0.1s;
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
