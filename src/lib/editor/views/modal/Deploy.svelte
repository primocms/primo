<script>
  import Icon from '@iconify/svelte'
  import _ from 'lodash-es'
  import axios from 'axios'
  import JSZip from 'jszip'
  import { saveAs } from 'file-saver'
  import { format } from 'timeago.js'
  import * as actions from '$lib/editor/stores/actions'
  import TextInput from '$lib/ui/TextInput.svelte'
  import Select from '$lib/editor/ui/inputs/Select.svelte'
  import modal from '$lib/editor/stores/app/modal'
  import { supabase } from '$lib/supabase'
  import pages from '$lib/editor/stores/data/pages'
  import { page } from '$app/stores'
  import { push_site, buildSiteBundle } from './Deploy'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'

  let stage = 'INITIAL'

  let active_deployment = $page.data.site.active_deployment
  if (active_deployment) {
    stage = 'CONNECT_REPO__ACTIVE'
  }

  let github_token = $page.data.config['github_token']['value'] || ''

  let github_account = $page.data.config['github_token']['options']?.user

  async function connect_github() {
    const headers = { Authorization: `Bearer ${github_token}` }

    const { data } = await axios.get(`https://api.github.com/user`, {
      headers: { ...headers, Accept: 'application/vnd.github.v3+json' },
    })

    if (data) {
      github_account = data
      stage = 'CONNECT_REPO'
      const res = await supabase
        .from('config')
        .update({ value: github_token, options: { user: github_account } })
        .eq('id', 'github_token')
    }
  }

  let files = []
  async function build_files() {
    const all_files = await buildSiteBundle({ pages: $pages })
    files = _.uniqBy(
      all_files.map((file) => {
        console.log({ file })
        return {
          ...file,
          file: file.path,
          data: file.content,
        }
      }),
      'file'
    ) // remove duplicated modules
  }

  async function download_site() {
    loading = true
    await build_files()
    const toDownload = await create_site_zip()
    saveAs(toDownload, `${$page.data.site.name}.zip`)
    modal.hide()

    async function create_site_zip() {
      const zip = new JSZip()
      files.forEach(({ file, data }) => {
        zip.file(file, data)
      })
      return await zip.generateAsync({ type: 'blob' })
    }
  }

  let repo_name = ''
  let repo = active_deployment?.repo.full_name
  async function create_repo() {
    const headers = { Authorization: `Bearer ${github_token}` }
    const { data } = await axios.post(
      `https://api.github.com/user/repos`,
      {
        name: repo_name,
        auto_init: true,
      },
      { headers }
    )
    repo = data
    active_deployment = await push_site({
      token: github_token,
      repo: repo.full_name,
    })
    stage = 'CONNECT_REPO__ACTIVE__SUCCESS'
  }

  async function deploy_to_repo() {
    loading = true
    active_deployment = await push_site({
      token: github_token,
      repo: repo_name || active_deployment.repo.full_name,
    })
    await supabase
      .from('sites')
      .update({ active_deployment })
      .eq('id', $page.data.site.id)
    stage = 'CONNECT_REPO__ACTIVE__SUCCESS'
    loading = false
  }

  let user_repos = []
  $: if (github_account) get_repos()
  async function get_repos() {
    const { data } = await axios.get(
      `https://api.github.com/users/${github_account.login}/repos?per_page=100`
    )
    user_repos = data?.map((repo) => {
      return {
        id: repo.full_name,
        label: repo.name,
      }
    })
  }

  const Title = (stage) => {
    const titles = {
      INITIAL: 'Deploy Site',
      CONNECT_GITHUB: 'Connect to Github',
      CONNECT_REPO: 'Deploy to Repository',
    }

    const proxy = new Proxy(titles, {
      get(target, prop, receiver) {
        const [key, title] = Object.entries(target).find(([key]) =>
          prop.startsWith(key)
        )
        return title
      },
    })

    return proxy[stage]
  }

  let loading = false
</script>

<div class="Deploy primo-reset">
  <header>
    <h2>
      <Icon icon="ic:sharp-publish" />
      <span>{Title(stage)}</span>
    </h2>
    <button on:click={() => modal.hide()}>
      <Icon icon="ic:baseline-close" />
    </button>
  </header>
  {#if stage === 'INITIAL'}
    <div class="container">
      <p>
        Primo sites are json files you can download them as json files or
        connect to github and then connect them to a host.
      </p>
      <div class="buttons">
        <button class="primo-button" on:click={download_site}>
          <Icon icon={loading ? 'eos-icons:loading' : 'ic:baseline-download'} />
          <span>Download</span>
        </button>
        {#if github_account}
          <button
            class="primo-button primary"
            on:click={() => (stage = 'CONNECT_REPO')}
          >
            <Icon icon="mdi:github" />
            <span>Deploy to Github</span>
          </button>
        {:else}
          <button
            class="primo-button primary"
            on:click={() => (stage = 'CONNECT_GITHUB')}
          >
            <Icon icon="mdi:github" />
            <span>Connect to Github</span>
          </button>
        {/if}
      </div>
    </div>
  {:else if stage === 'CONNECT_GITHUB'}
    <div class="container">
      <p>
        This is how you connect to github. Set up an account and do this, see
        the docs for more details.
      </p>
      <div>
        <p>Enter API Token</p>
        <form on:submit|preventDefault={connect_github}>
          <div>
            <TextInput bind:value={github_token} placeholder="Token" />
            <button class="primo-button">Connect</button>
          </div>
        </form>
      </div>
    </div>
  {:else if stage.startsWith('CONNECT_REPO')}
    <div class="container">
      <div class="account-card">
        <div class="user">
          <img src={github_account?.avatar_url} alt="" />
          <span>{github_account?.login}</span>
        </div>
        <button
          class="primo-link"
          on:click={() => {
            github_token = ''
            github_account = null
            stage = 'CONNECT_GITHUB'
          }}
        >
          edit
        </button>
      </div>
      {#if stage === 'CONNECT_REPO'}
        <div class="buttons">
          <button
            class="primo-button"
            on:click={() => (stage = 'CONNECT_REPO__USE_EXISTING')}
          >
            Use existing repo
          </button>
          <button
            class="primo-button primary"
            on:click={() => (stage = 'CONNECT_REPO__CREATE_REPO')}
          >
            Create new repo
          </button>
        </div>
      {:else if stage === 'CONNECT_REPO__CREATE_REPO'}
        <div class="create-repo">
          <header>
            <h3>Create new repo</h3>
            <button on:click={() => (stage = 'CONNECT_REPO__USE_EXISTING')}>
              use existing repo instead
            </button>
          </header>
          <form on:submit|preventDefault={create_repo}>
            <p class="form-label">Enter repo name</p>
            <div>
              <TextInput bind:value={repo_name} placeholder="Site" />
              <button class="primo-button primary">Deploy</button>
            </div>
          </form>
          <footer>
            after deploying this repo will be create in your Github account.
          </footer>
        </div>
      {:else if stage === 'CONNECT_REPO__USE_EXISTING'}
        <div class="create-repo">
          <header>
            <h3>Connect to existing repo</h3>
            <button on:click={() => (stage = 'CONNECT_REPO__CREATE_REPO')}>
              create new repo instead
            </button>
          </header>
          <form on:submit|preventDefault={deploy_to_repo}>
            <p class="form-label">Select repo</p>
            <div>
              <Select bind:value={repo_name} options={user_repos} />
              <PrimaryButton type="submit" label="Deploy" {loading} />
            </div>
          </form>
          <footer>
            after deploying this repo will be create in your Github account.
          </footer>
        </div>
      {:else if stage.startsWith('CONNECT_REPO__ACTIVE')}
        <div class="repo-card">
          <div>
            <a
              class="name"
              href={active_deployment.repo.html_url}
              target="_blank"
            >
              {active_deployment.repo.full_name}
            </a>
            <span class="last-updated">
              {format(active_deployment.created)}
            </span>
          </div>
          <button class="primo-link" on:click={() => (stage = 'CONNECT_REPO')}>
            edit
          </button>
        </div>
        {#if stage !== 'CONNECT_REPO__ACTIVE__SUCCESS'}
          <div class="buttons">
            <PrimaryButton label="Deploy" {loading} on:click={deploy_to_repo} />
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</div>

<style lang="postcss">
  .Deploy.primo-reset {
    background: var(--primo-color-black);
    padding: 1.125rem 1.25rem;
    display: grid;
    gap: 1rem;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h2 {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
    }
  }
  .container {
    display: grid;
    gap: 1rem;
  }
  .account-card {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0.5rem;
    border-radius: 0.25rem;
    border: 0.8px solid #6e6e6e;

    .user {
      font-weight: 400;
      font-size: 0.75rem;
      line-height: 1.125rem;
      color: #cecece;
      display: flex;
      align-items: center;
      gap: 0.5rem;

      img {
        width: 2rem;
        aspect-ratio: 1 / 1;
        border-radius: 50%;
      }
    }
  }

  .primo-link {
    font-size: 0.875rem;
    color: var(--color-gray-3);
    text-decoration: underline;
  }

  .create-repo {
    header {
      display: flex;
      align-items: center;
      button {
        font-size: 0.75rem;
        color: #9d9d9d;
        text-decoration: underline;
      }
    }
    .form-label {
      font-size: 12px;
      color: #b6b6b6;
      margin-bottom: 0.125rem;
    }
    footer {
      font-size: 0.625rem;
      color: #858585;
      margin-top: 0.25rem;
    }
  }

  .repo-card {
    display: flex;

    div {
      flex: 1;
      display: grid;
    }

    .name {
      text-decoration: underline;
    }

    .last-updated {
      font-size: 0.75rem;
      color: #b6b6b6;
    }
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
  }
  .primo-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 7px 16px;
    background: #1f1f1f;
    border-radius: 0.25rem;
  }
  .primo-button.primary {
    border: 1px solid #35d994;
    background: transparent;
  }
  form {
    margin-top: 0.5rem;

    div {
      display: flex;
      gap: 0.5rem;
    }
  }
  :global(form > label) {
    flex: 1;
  }
</style>
