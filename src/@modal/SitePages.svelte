<script>
  import _ from 'lodash'
  import {onMount,onDestroy} from 'svelte'
  import { link } from 'svelte-routing';
  import {fade} from 'svelte/transition'
  import {SelectOne,TextInput} from '../@components/inputs'
  import {PrimaryButton} from '../@components/buttons'
  import {Spinner,Card,Countdown} from '../@components/misc'
  import PageItem from './PageList/PageItem.svelte'
  import ShortUniqueId from 'short-unique-id';

  import modal from '../@stores/app/modal'
  import {domainInfo,site,tailwind} from '../@stores/data'
  import pageData from '../@stores/data/pageData'

  let pages = []
  $: {
    pages = pages.map(p => ({ key: getUniqueId(), ...p })) // Add keys for templating (if one doesn't exist)
  }

  async function createPage(form) {
    const inputs = Object.values(form.target)
    const [ title, url ] = inputs.map(f => f.value)
    const isEmpty = inputs[2].classList.contains('selected')
    const newPage = isEmpty ? {
      id: url,
      title,
      content: [
        {
          id: getUniqueId(),
          width: 'contained',
          columns: [
            {
              id: getUniqueId(),
              size: 'w-full',
              rows: [
                {
                  id: getUniqueId(),
                  type: 'content',
                  value: {
                    html: '<p><br></p>'
                  }
                }
              ]
            }
          ]
        }
      ],
      styles: {
        raw: '',
        final: '',
        tailwind: '{  theme: {    container: {      center: true    }  },  variants: {}}'
      },
      dependencies: {
        headEmbed : '',
        libraries: [],
        // customScripts: [],
      },
      settings: {
        javascript: '',
        identity : {
          title, 
          url,
          description: ''
        }
      }
    } : duplicatePage($pageData, title, url) 
    site.pages.add(newPage)
    creatingPage = false
    pageUrl = ''
  }

  async function deletePage(pageId) {
    site.pages.remove(pageId)
  }

  function duplicatePage(page, title, url) {
    const newPage = _.cloneDeep(page)
    const [newContent, IDmap] = scrambleIds(page.content)
    newPage.content = newContent
    newPage.title = title
    newPage.id = url

    // Replace all the old IDs in the page styles with the new IDs
    let rawPageStyles = newPage.styles.raw
    let finalPageStyles = newPage.styles.final
    IDmap.forEach(([oldID, newID]) => {
      newPage.styles.raw = rawPageStyles.replace(
        new RegExp(oldID, 'g'),
        newID
      )
      newPage.styles.final = finalPageStyles.replace(
        new RegExp(oldID, 'g'),
        newID
      )
    })

    // Replace all the old IDs in the components
    IDmap.forEach(([oldID, newID]) => {
      newPage.content = newPage.content.map((section) => ({
        ...section,
        columns: section.columns.map((column) => ({
          ...column,
          rows: column.rows.map((row) =>
            row.type === 'component'
              ? {
                  ...row,
                  value: {
                    ...row.value,
                    raw: {
                      ...row.value.raw,
                      css: row.value.raw.css.replace(
                        new RegExp(oldID, 'g'),
                        newID
                      ),
                    },
                    final: {
                      ...row.value.final,
                      css: row.value.final.css.replace(
                        new RegExp(oldID, 'g'),
                        newID
                      ),
                    },
                  },
                }
              : row
          ),
        })),
      }))
    })
    return newPage

    function scrambleIds(content) {
      let IDs = []
      const newContent = content.map(section => {
        const newID = getUniqueId()
        IDs.push([ section.id, newID])
        return {
          ...section,
          id: newID,
          columns: section.columns.map(column => {
            const newID = getUniqueId()
            IDs.push([ column.id, newID])
            return {
              ...column,
              id: newID,
              rows: column.rows.map(row => {
                const newID = getUniqueId()
                IDs.push([ row.id, newID])
                return {
                  ...row, 
                  id: newID
                }
              })
            }
          })
        }
      })
      return [ newContent, IDs ]
    }

    function getUniqueId() {
      return new ShortUniqueId().randomUUID(5).toLowerCase();
    }
  }

  let creatingPage = false

  let pageBeingCreated
  let pageBeingDeleted

  let mounted = false
  onMount(async () => {
    mounted = true
  })

  function validateUrl ({ detail }) {
    let validUrl 
    if (detail) {
      validUrl = str.replace(/\s+/g, '-').replace(/[^0-9a-z\-._]/ig, '').toLowerCase() 
    } else {
      validUrl = ''
    }
    pageUrl = validUrl
  }

  let pageUrl = ''



</script>

<ul class="grid grid-cols-2 gap-4">
  {#each $site.pages as page (page.id)}
    <li transition:fade={{ duration: 200 }} id="page-{page.id}">
      <div class="shadow-xl mb-4 rounded">
        <PageItem {page} />
        <div class="w-full flex justify-between px-3 py-2 border-t border-gray-100 ">
          <div>
            {#if $pageData.id === page.id}
              <span class="text-xs font-semibold text-gray-700">{page.title}</span>
            {:else}
              <a use:link class="text-xs font-semibold text-blue-500 underline hover:text-blue-800 transition-colors duration-200" href="/{page.id === 'index' ? '' : page.id}">{page.title}</a>
            {/if}
          </div>
          <div class="flex justify-end">
            {#if page.id !== 'index'}
              <button title="Delete page" on:click={() => deletePage(page.id)} class="delete-page text-xs text-yellow-800 hover:text-yellow-900">
                <i class="fas fa-trash"></i>
              </button>
            {/if}
          </div>
        </div>
      </div>
    </li>
  {/each}
</ul>

<div>
  {#if !creatingPage}
  <PrimaryButton on:click={() => creatingPage = true} id="new-page" icon="fas fa-plus mr-2">
    New Page
  </PrimaryButton>
  {:else}
    <Card variants="p-4">
      <form on:submit|preventDefault={createPage} in:fade={{ duration: 100 }}>
        <TextInput id="page-title" autofocus={true} variants="mb-4" label="Page Label" placeholder="About Us" />
        <TextInput id="page-url" variants="mb-4" label="Page URL" prefix="/" on:input={validateUrl} bind:value={pageUrl} placeholder="about-us" />
        <SelectOne 
          id="page-base"
          variants="mb-8"
          label="Page Base" 
          options={[ 'Empty', 'Duplicate' ]}
        />
        <PrimaryButton id="create-page" type='submit'>Create</PrimaryButton>
      </form>
    </Card>
  {/if}
</div>

<style>
  li {
    @apply list-none;
  }
  .page-title {
    @apply text-lg font-semibold transition-colors duration-100 items-start;
  }
  a.page-title {
    @apply underline text-blue-700;
  }
  a.page-title:hover {
    @apply text-blue-800;
  }
  button {
    @apply transition-colors duration-200;
  }
</style>