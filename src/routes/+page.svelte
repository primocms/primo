<script lang="ts">
  import Icon from '@iconify/svelte'
  import DashboardToolbar from '$lib/components/DashboardToolbar.svelte'
  import SiteFooter from '$lib/components/SiteFooter.svelte'
  import SiteThumbnail from '$lib/components/SiteThumbnail.svelte'
  import Modal, { show, hide } from '$lib/components/Modal.svelte'
  import sites from '../stores/sites'
  import user from '../stores/user'
  import * as actions from '../actions'

  export let data

  if (data) actions.setCustomization(data, false)

  function beginInvitation(site): void {
    show({
      id: 'COLLABORATION',
      props: {
        site,
      },
    })
  }

  let loading
  function createSite(): void {
    show({
      id: 'SITE_CREATION',
      props: {
        onSuccess: async (site) => {
          await actions.sites.create(site)
          // goto(site.id) // broken in production
          hide()
        },
      },
    })
  }

  async function deleteSiteItem(siteID: string): Promise<any> {
    const confirm = window.confirm(
      `Are you sure you want to delete this site? You won't be able to get it back.`
    )
    if (!confirm) return
    actions.sites.delete(siteID)
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
  function showCollaborators(site) {
    // modal.show("COLLABORATORS", { site });
  }
</script>

<main class="primo-reset">
  {#if $user.signedIn}
    <div class="container">
      <DashboardToolbar />
      <div class="sites-container">
        <ul class="sites" xyz="fade stagger stagger-1">
          {#each $sites as site, i (site.id)}
            <li class="xyz-in">
              <a class="site-link" href={site.id}>
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
                    <a data-sveltekit-prefetch href={site.id}>
                      <span>{site.name}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        class="s-Uap-jPRb-uiE"
                        ><path
                          fill-rule="evenodd"
                          d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                          clip-rule="evenodd"
                          class="s-Uap-jPRb-uiE"
                        /></svg
                      >
                    </a>
                  {/if}
                </div>
                <span class="site-url">{site.id}</span>
                {#if !$user.sites}
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"
                        />
                        <path
                          fill-rule="evenodd"
                          d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"
                          clip-rule="evenodd"
                        />
                      </svg>
                      <span>Rename</span>
                    </button>
                    <button
                      class="site-button"
                      on:click={() => deleteSiteItem(site.id)}
                    >
                      <svg
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                        ><path
                          fill-rule="evenodd"
                          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clip-rule="evenodd"
                        /></svg
                      >
                      <span>Delete</span>
                    </button>
                  </div>
                {/if}
              </div>
            </li>
          {/each}
          {#if !$user.sites}
            <li>
              <button class="create-site" on:click={createSite}>
                {#if loading}
                  <!-- <Spinner /> -->
                {:else}
                  <svg
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                    ><path
                      fill-rule="evenodd"
                      d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                      clip-rule="evenodd"
                    /></svg
                  >
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
    padding-top: 1rem;

    .container {
      display: flex;
      flex-direction: column;
      border-radius: var(--primo-border-radius);
      margin: 0 auto;
      padding: 2rem;
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
                display: grid;
                grid-template-columns: auto auto;
                place-items: center flex-start;

                &:hover {
                  color: var(--primo-color-brand);
                }

                svg {
                  width: 1.5rem;
                  margin-top: 3px;
                  justify-self: flex-end;
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

                svg {
                  width: 1rem;
                  height: 1rem;
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

          svg {
            border-radius: 50%;
            transition: background 0.1s;
            height: 2rem;
            width: 2rem;
          }

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
    svg {
      padding-right: 0.25rem;
      width: 1.25rem;
      height: 1.25rem;
    }
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
