<script>
  import { flattenDeep, uniqBy } from 'lodash-es'
  import JSZip from 'jszip'
  import fileSaver from 'file-saver'
  import beautify from 'js-beautify'
  import Hosting from '$lib/components/Hosting.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import { site, modal } from '@primo-app/primo'
  import { buildStaticPage } from '@primo-app/primo/src/stores/helpers'
  import hosts from '../stores/hosts'
  import {sites} from '../actions'
  import ModalHeader from '@primo-app/primo/src/views/modal/ModalHeader.svelte'
  import { page } from '$app/stores'
  // import { addDeploymentToSite } from '$lib/actions'

  // TimeAgo.addDefaultLocale(en)
  // const timeAgo = new TimeAgo('en-US')

  const siteID = $page.params.site

  let loading = false

  async function createSiteZip() {
    const zip = new JSZip()
    const files = await buildSiteBundle($site, siteID)
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

  let deployment
  let activeDeployment
  async function publishToHosts() {
    loading = true

    const files = (await buildSiteBundle($site, siteID)).map((file) => {
      return {
        file: file.path,
        data: file.content,
      }
    })
    const uniqueFiles = uniqBy(files, 'file') // modules are duplicated

    sites.save($site)
    const res = await sites.publish({
      siteID,
      host: $hosts[0],
      files: uniqueFiles
    })

    if (!res) {
      alert('There was an error publishing your site')
    } else {
      deployment = res
    }

    loading = false

    pages = []
  }

  async function buildSiteBundle(site, siteName) {
    
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
          path: `_modules/${module.id}.js`,
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
        {
          path: `primo.json`,
          content: json,
        }
      ]
    }
  }

  let pages = []
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
      {#if deployment}
        <div class="boxes">
          <div class="box">
            <div class="deployment">
              Published to
              <a href={deployment.url} rel="external" target="blank"
                >{deployment.url}</a
              >
            </div>
          </div>
        </div>
      {/if}
      <!-- show activeDeployment from addDeploymentToSite-->
      <header class="review">
        <div>
          {#if activeDeployment && deployment}
            <div class="boxes">
              <div class="box">
                <div class="deployment">
                  Active Deployment
                  <a href={activeDeployment.url} rel="external" target="blank"
                    >{activeDeployment.url}</a
                  >
                </div>
              </div>
            </div>
          {/if}
          {#if pages.length > 0 && !deployment}
            <p class="title">Review and Publish</p>
            <p class="subtitle">
              Here are the changes that you're making to your site
            </p>
            <PrimaryButton
              on:click={publishToHosts}
              label="Save and Publish"
              {loading}
            />
          {:else if $hosts.length > 0 && !deployment}
            <p class="title">Publish Changes</p>
            <PrimaryButton
              on:click={publishToHosts}
              label="Save and Publish"
              {loading}
            />
          {:else if !deployment}
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
        flex-direction: column;

        &:not(:last-child) {
          border-bottom: 1px solid var(--color-gray-8);
        }

        .deployment {
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

          &:not(:last-child) {
            border-bottom: 1px solid var(--color-gray-8);
          }
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
