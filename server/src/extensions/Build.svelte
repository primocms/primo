<script>
  import { flattenDeep, uniqBy, find } from 'lodash-es'
  import JSZip from 'jszip'
  import fileSaver from 'file-saver'
  import beautify from 'js-beautify'
  import { format } from 'timeago.js'
  import Hosting from '$lib/components/Hosting.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import { site, modal } from '@primo-app/primo'
  import { buildStaticPage } from '@primo-app/primo/src/stores/helpers'
  import hosts from '../stores/hosts'
  import allSites from '../stores/sites'
  import {sites} from '../actions'
  import ModalHeader from '@primo-app/primo/src/views/modal/ModalHeader.svelte'
  import { page } from '$app/stores'

  const siteID = $page.params.site

  let loading = false

  async function createSiteZip() {
    const zip = new JSZip()
    const files = await buildSiteBundle($site)
    files.forEach((file) => {
      zip.file(file.path, file.content)
    })
    return await zip.generateAsync({ type: 'blob' })
  }

  async function downloadSite() {
    loading = true
    const toDownload = await createSiteZip()
    fileSaver.saveAs(toDownload, `${siteID}.zip`)
    modal.hide()
  }

  let lastDeployment = find($allSites, ['id', siteID])?.['active_deployment']
  let newDeployment

  async function publishToHosts() {
    loading = true
    const files = (await buildSiteBundle($site)).map((file) => {
      return {
        file: file.path,
        data: file.content,
      }
    })
    const uniqueFiles = uniqBy(files, 'file') // modules are duplicated
    sites.save($site)
    const activeHost = $hosts[0]
    const {deployment, error} = await sites.publish({
      siteID,
      host: activeHost,
      files: uniqueFiles
    })

    if (error) {
      alert(error)
    } else {
      newDeployment = deployment
    }

    loading = false
  }

  async function buildSiteBundle(site) {
    const pages = await Promise.all([
      ...site.pages.map((page) => buildPageTree({ page, site })),
      // ...Object.entries(site.content).map((item) => ({
      //   path: `${item[0]}.json`,
      //   content: JSON.stringify(item[1]),
      // })),
    ])
    return buildSiteTree(pages, site)

    async function buildPageTree({ page, site }) {
      const { id } = page
      const { html, modules } = await buildStaticPage({
        page,
        site,
        separateModules: true,
      })
      const formattedHTML = await beautify.html(html)

      return await Promise.all([
        {
          path: `${id === 'index' ? `index.html` : `${id}/index.html`}`,
          content: formattedHTML,
        },
        ...modules.map((module) => ({
          path: `_modules/${module.symbol}.js`,
          content: module.content,
        })),
        ...(page.pages
          ? page.pages.map((subpage) => buildPageTree({ page: subpage, site }))
          : []),
      ])
    }

    async function buildSiteTree(pages, site) {
      const json = JSON.stringify(site)

      return [
        ...flattenDeep(pages),
        ...Object.entries(site.content).map(([locale, content]) => ({
          path: `${locale}.json`,
          content: JSON.stringify(content)
        })),
        {
          path: `primo.json`,
          content: json,
        },
        {
          path: 'robots.txt',
          content: `User-agent: *`
        }
      ]
    }
  }

  function disconnectSite() {
    lastDeployment = null
    sites.update({
      id: siteID,
      props: {
        active_deployment: null,
      }
    })
  }
</script>

<ModalHeader icon="fas fa-globe" title="Publish" variants="mb-4" />

<main class="primo-reset">
  <div class="publish">
    <div>
      <Hosting
        buttons={[
          {
            label: 'Download Site',
            onclick: downloadSite,
          },
        ]}
      />
    </div>
    <div>
      <header class="review">
        <div>
          {#if newDeployment}
            <div class="boxes">
              <div class="box">
                <div class="newDeployment">
                  Published to
                  <a href={newDeployment.url} rel="external" target="blank"
                    >{newDeployment.url}</a
                  >
                </div>
              </div>
            </div>
          {:else if lastDeployment}
            <div class="boxes">
              <div class="box">
                <div class="newDeployment">
                  Published {format(lastDeployment.created)} to
                  <a href={lastDeployment.url} rel="external" target="blank"
                    >{lastDeployment.url}</a
                  >
                </div>
                <button on:click={disconnectSite}>Disconnect</button>
              </div>
            </div>
          {/if}
          {#if $hosts.length > 0 && !newDeployment}
            <p class="title">Publish Changes</p>
            <PrimaryButton
              on:click={publishToHosts}
              label="Publish"
              {loading}
            />
          {:else if !newDeployment}
            <p class="title">Download your website</p>
            <p class="subtitle">
              You can connect a web host to publish your website directly from
              primo, or download it to publish it manually
            </p>
            <PrimaryButton
              on:click={downloadSite}
              label="Download your site"
              {loading}
            />
          {/if}
        </div>
      </header>
    </div>
  </div>
</main>

<style lang="postcss">
  .title {
    margin-bottom: 0.5rem;
    color: var(--color-gray-1);
    font-weight: 600;
    transition: color 0.1s;
  }

  .subtitle {
    color: var(--color-gray-2);
    margin-bottom: 1rem;
    font-size: var(--font-size-2);
    line-height: 1.5;
  }

  main {
    background: var(--primo-color-black);
    color: var(--color-gray-1);
    padding: 1rem;

    .publish {
      display: grid;
      gap: 1rem;
      place-items: flex-start normal;

      .boxes {
        margin-bottom: 1rem;
      }

      .box {
        padding: 1rem;
        background: var(--color-gray-9);
        color: var(--color-gray-2);
        display: flex;
        justify-content: space-between;
        align-items: center;

        .newDeployment {
          padding: 0.5rem 0;
          display: flex;
          flex-direction: column;

          a {
            text-decoration: underline;
            transition: color 0.1s;
            &:hover {
              color: var(--color-primored);
            }
          }
        }

        button {
          padding: 0.5rem 1rem;
          border: 1px solid var(--color-gray-8);
          border-radius: var(--primo-border-radius);
        }
      }
    }
  }

  @media (max-width: 600px) {
    main {
      .publish {
        grid-template-columns: auto;
      }
    }
  }
</style>
