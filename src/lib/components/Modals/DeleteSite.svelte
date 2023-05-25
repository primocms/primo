<script>
  import Spinner from '$lib/ui/Spinner.svelte'
  import Switch from '$lib/editor/field-types/Switch.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'

  export let onSuccess = (files, repo) => {}
  export let site

  let loading = false
  let finishing = false
  let files = false
  let repo = false
  let canDeleteSite = false

  async function deleteSite() {
    finishing = true
    onSuccess(files, repo)
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
            label: 'Also delete files in bucket',
            value: false,
          }}
          on:input={() => (files = !files)}
        />
      </div>
      {#if site.active_deployment}
        <div class="options">
          <Switch
            field={{
              key: 'repo',
              label: 'Also delete Github repo',
              value: false,
            }}
            on:input={() => (repo = !repo)}
          />
        </div>
      {/if}
      <div class="options">
        <Switch
          field={{
            key: 'canDeleteSite',
            label: 'I am sure about this',
            value: false,
          }}
          on:input={() => (canDeleteSite = !canDeleteSite)}
        />
      </div>
      <div class="submit">
        <PrimaryButton
          type="submit"
          label="Delete Site"
          icon="pepicons-pop:trash"
          disabled={!canDeleteSite}
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
