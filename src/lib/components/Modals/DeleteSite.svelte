<script>
  import Spinner from '$lib/ui/Spinner.svelte'
  import Switch from '$lib/editor/field-types/Switch.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'

  export let onSuccess = (site, files, repo) => {}
  export let site

  let loading = false
  let finishing = false
  let message = ''
  let files = false
  let repo = false

  async function deleteSite() {
    finishing = true
    onSuccess(site, files, repo)
  }
</script>

<main class="primo-reset primo-modal">
  {#if !finishing}
    <h1 class="primo-heading-xl">Delete {site.name}</h1>
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
              key: 'files',
              label: 'Also delete Github repo',
              value: false,
            }}
            on:input={() => (repo = !repo)}
          />
        </div>
      {/if}
      <div class="submit">
        <PrimaryButton
          type="submit"
          label="Delete Site"
          icon="ion:trash"
          {loading}
        />
      </div>
    </form>
  {:else}
    <div class="deleting-site">
      <span>Deleting {site.name}</span>
      {#key message}
        <p>{message}</p>
      {/key}
      <Spinner />
    </div>
  {/if}
</main>

<style lang="postcss">
  .primo-modal {
    max-width: var(--primo-max-width-1);

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

  .error {
    padding: 1rem;
    background: #b00020;
    margin-bottom: 1rem;
  }

  .deleting-site {
    display: flex;
    align-items: center;

    & > * {
      margin: 0 1rem;
    }
  }
</style>
