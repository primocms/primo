<script>
  import Spinner from '$lib/ui/Spinner.svelte'
  import Switch from '$lib/ui/Switch.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import { sites } from '$lib/actions'
  import { hide } from '$lib/components/Modal.svelte'

  export let site

  let loading = false
  let finishing = false
  let delete_files = false
  let delete_repo = false

  async function deleteSite() {
    finishing = true
    await sites.delete(site, { delete_repo, delete_files })
    hide()
  }
</script>

<main class="primo-reset primo-modal">
  {#if !finishing}
    <h2>Delete {site.name}</h2>
    <p>
      Are you sure you want to delete this site? You won't be able to get it
      back.
    </p>
    <form on:submit|preventDefault={deleteSite}>
      <div class="options">
        <Switch
          field={{
            key: 'files',
            label: 'Delete site files',
            value: false,
          }}
          on:input={() => (delete_files = !delete_files)}
        />
      </div>
      {#if site.active_deployment}
        <div class="options">
          <Switch
            field={{
              key: 'repo',
              label: 'Delete Github repo',
              value: false,
            }}
            on:input={() => (delete_repo = !delete_repo)}
          />
        </div>
      {/if}
      <div class="submit">
        <PrimaryButton
          type="submit"
          label="Delete Site"
          icon="pepicons-pop:trash"
          {loading}
        />
      </div>
    </form>
  {:else}
    <div class="deleting-site">
      <span>Deleting {site.name}</span>
      <Spinner />
    </div>
  {/if}
</main>

<style lang="postcss">
  .primo-modal {
    max-width: var(--primo-max-width-1);
    display: grid;
    gap: 1.5rem;

    h2 {
      font-weight: 700;
      font-size: 1rem;
    }

    form {
      .options {
        margin-bottom: 1.5rem;
        margin-top: 0.5rem;
      }

      .submit {
        --color-link: var(--color-primored);
      }
    }
  }

  .deleting-site {
    display: flex;
    align-items: center;

    & > * {
      margin: 0 1rem;
    }
  }
</style>
