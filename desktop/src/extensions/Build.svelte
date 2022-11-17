<script>
  import { flattenDeep, uniqBy, find, isEqual as _isEqual, cloneDeep as _cloneDeep } from 'lodash-es'
  import JSZip from 'jszip'
  import { saveAs } from 'file-saver'
  import beautify from 'js-beautify'
  import {_ as C} from 'svelte-i18n'
  import { format } from 'timeago.js'
  import Hosting from '$lib/components/Hosting.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import { site, modal } from '@primo-app/primo'
  import { locales } from '@primo-app/primo/src/const'
  import { buildStaticPage } from '@primo-app/primo/src/stores/helpers'
  import hosts from '../stores/hosts'
  import sites from '../stores/sites'
  import ModalHeader from '@primo-app/primo/src/views/modal/ModalHeader.svelte'
  import { page } from '$app/stores'
  import {addDeploymentToSite} from '$lib/actions'
  import {pushSite, createRepo} from './hosts/github'
  import netlify from './hosts/netlify'
  import vercel from './hosts/vercel'

  const siteID = $page.params.site
  let lastDeployment = find($sites, ['id', siteID])?.activeDeployment

  let loading = false
  
  const SHOW_CHANGED_PAGES = $hosts[0]?.['name'] === 'github'

  async function createSiteZip() {
    const zip = new JSZip()
    files.forEach(({file, data}) => {
      zip.file(file, data)
    })
    return await zip.generateAsync({ type: 'blob' })
  }

  async function downloadSite() {
    loading = true
    if (files.length === 0) { // wait for files to build
      setTimeout(downloadSite, 1000) 
      return
    }
    const toDownload = await createSiteZip()
    saveAs(toDownload, `${siteID}.zip`)
    modal.hide()
  }
  
  // get updated pages
  const previousSite = lastDeployment ? lastDeployment.site : null
  let changed_pages = []
  if (previousSite) {
    const siteCodeMatches = _isEqual(previousSite.code, $site.code)
    changed_pages = !siteCodeMatches 
      ? $site.pages 
      : Object.entries(previousSite.content['en']).map(([pageID, content]) => {
        // if it's different from the new site, or doesn't exist in the new site, or only exists in the new site
        const newPage = find($site.pages, ['id', pageID])
        const previousPage = find(previousSite.pages, ['id', pageID])
        
        if (!newPage) return
        
        const previousContent = $site.content['en'][pageID]
        const pageContentMatches = _isEqual(previousContent, content)
        const pageCodeMatches = _isEqual(previousPage.code, newPage.code)
        
        if (!pageContentMatches || !pageCodeMatches) return find($site.pages, ['id', pageID])
        
      }).filter(Boolean)
  }
  
  let files = []
  build_files()
  async function build_files() {
    const all_files = await buildSiteBundle($site, SHOW_CHANGED_PAGES ? changed_pages : [])
    files = uniqBy(all_files.map((file) => {
      return {
        file: file.path,
        data: file.content,
      }
    }), 'file') // remove duplicated modules
  }

  let newDeployment
  async function publishToHosts() {
    loading = true
    await build_files()
    const [activeHost] = $hosts
    const { name, token } = activeHost
    
    try {
      if (name === 'vercel') {
        const data = await vercel.create_or_update_site({ name: siteID, files, token })
        newDeployment = {
          id: data.id,
          url: `https://${data.alias[0]}`,
          created: data.createdAt,
          site: _cloneDeep($site)
        }
      } else if (name === 'netlify') {
        if (lastDeployment) { // Upload updated site
          await netlify.updateSite({ id: lastDeployment.id, files, token })
          newDeployment = {
            ...lastDeployment,
            created: Date.now(),
            site: _cloneDeep($site)
          }
        } else { // Create new site
          const {id, url} = await netlify.createSite({ files, token })
          newDeployment = {
            id,
            url,
            created: Date.now(),
            site: _cloneDeep($site)
          }
        }
      
      } else if (name === 'github') {    
        if (lastDeployment) { // Push updates  
          const sha = await pushSite({
            token,
            repo: lastDeployment.id,
            files,
            activeSha: lastDeployment.deploy_id
          })
          newDeployment = {
            ...lastDeployment,
            deploy_id: sha,
            created: Date.now(),
            site: _cloneDeep($site)
          }
        } else { // Create repo  
          const { html_url, full_name } = await createRepo({ token, name: siteID })
          const sha = await pushSite({
            token,
            repo: full_name,
            files
          })
          newDeployment = {
            id: full_name,
            deploy_id: sha,
            url: html_url,
            created: Date.now(),
            site: _cloneDeep($site)
          }
        }
      }
    } catch(e) {
      console.error(e)
      alert('Could not publish site, see console for details')
    }
    
      // check for null data before continuing if null then handle this error else continue
    if (!newDeployment) {
      console.warn('Error creating site')
    } else {
      addDeploymentToSite({ siteID, deployment: newDeployment })
    }
    
    loading = false
  }

  async function buildSiteBundle(site, pages_to_build = []) {
      
    const will_build = pages_to_build.length > 0 ? pages_to_build : site.pages

    const pages = await Promise.all([
      ...will_build.map((page) => buildPageTree({ page, site })),
      {
        path: `primo.json`,
        content: JSON.stringify(site),
      },
    ])

    return buildSiteTree(pages, site)

    async function buildPageTree({ page, site }) {

      const { modules } = await buildStaticPage({
        page,
        site,
        separateModules: true
      })

      const pages = await Promise.all(Object.keys(site.content).map(async (locale) => {

        const { html } = await buildStaticPage({
          page,
          site,
          separateModules: true,
          locale
        })
        const formattedHTML = await beautify.html(html)

        let path 
        if (page.id === 'index' || page.id === '404') {
          if (locale === 'en') {
            path = `${page.id}.html`
          } else {
            path = `${locale}/${page.id}.html`
          }
        } else {
          if (locale === 'en') {
            path = `${page.id}/index.html`
          } else {
            path = `${locale}/${page.id}/index.html`
          }
        }

        return await Promise.all([
          {
            path,
            content: formattedHTML,
          },
          ...(page.pages
            ? page.pages.map((subpage) => buildPageTree({ page: subpage, site }))
            : []),
        ])
      }))

      return [
        ...flattenDeep(pages),
        ...Object.entries(site.content).map(([locale, content]) => ({
          path: `${locale}.json`,
          content: JSON.stringify(content)
        })),
        ...modules.map((module) => ({
          path: `_modules/${module.symbol}.js`,
          content: module.content,
        })),
      ]
    }

    async function buildSiteTree(pages, site) {
      const json = JSON.stringify(site)

      return [
        ...flattenDeep(pages),
        // {
        //   path: `styles.css`,
        //   content: styles
        // },
        // {
        //   path: `primo.json`,
        //   content: json,
        // },
        // {
        //   path: 'README.md',
        //   content: `# Built with [primo](https://primo.af)`,
        // },
      ]
    }
  }
</script>

<ModalHeader icon="fas fa-globe" title={$C('Publish')} />

<main class="primo-reset">
  <div class="publish">
    <div>
      <Hosting
        buttons={[
          {
            label: $C('publish.download_heading'),
            onclick: downloadSite,
          },
        ]}
      />
    </div>
    <div>
      {#if newDeployment}
        <div class="boxes">
          <div class="box">
            {#each Object.keys($site.content) as locale}
              <div class="newDeployment">
                {#if Object.keys($site.content).length > 1}
                  {(find(locales, ['key', locale])['name'])} site published to
                {:else}
                  {$C('publish.published_to')}
                {/if}
                <a
                  href="{lastDeployment ? lastDeployment.url : newDeployment.url}/{locale !== 'en' ? locale : ''}"
                  rel="external"
                  target="blank"
                  >{lastDeployment ? lastDeployment.url : newDeployment.url}/{locale !== 'en' ? locale : ''}</a
                >
              </div>
            {/each}
          </div>
        </div>
      {:else if lastDeployment}
        <div class="boxes">
          <div class="box">
            <div class="newDeployment">
              {$C('publish.last_published_to')}
              <a href={lastDeployment.url} rel="external" target="blank"
                >{lastDeployment.url}</a
              >
              <span>{format(lastDeployment.created)}</span>
            </div>
          </div>
        </div>
      {/if}
      {#if !newDeployment}
        <header class="review">
          <div>
            {#if $hosts.length > 0}
              <p class="title">{$C('publish.publish_site')}</p>
              <p class="subtitle">{$C('publish.description')}</p>
              <PrimaryButton
                on:click={publishToHosts}
                label={$C('publish.publish_site')}
                {loading}
              />
            {:else}
              <p class="title">{$C('publish.download_heading')}</p>
              <p class="subtitle">{$C('publish.download_description')}</p>
              <PrimaryButton
                on:click={downloadSite}
                label="Download site"
                {loading}
              />
            {/if}
          </div>
        </header>
      {/if}
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

        .newDeployment {
          padding: 1rem 0;
          display: flex;
          flex-direction: column;
          
          span {font-size: 0.875rem}

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
  
  header.review {
    .changed-pages {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .page-item {
      font-size: 0.75rem;
      color: var(--color-gray-2);
    }
  }
  
    .page-body {
      border-top: 1px solid var(--color-gray-9);
      height: 0;
      padding-top: calc(75% - 37px);
      /* include header in square */
      position: relative;
      overflow: hidden;
    
      .page-link {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        background: var(--primo-color-white);
        display: block;
        width: 100%;
        overflow: hidden;
        transition: var(--transition-colors);
        min-height: 10rem;
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
