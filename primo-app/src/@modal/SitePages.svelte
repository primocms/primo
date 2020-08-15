<script>
  import _ from 'lodash'
  import {onMount,onDestroy} from 'svelte'
  import { link } from 'svelte-routing';
  import {fade} from 'svelte/transition'
  import {SelectOne,TextInput} from '../@components/inputs'
  import {PrimaryButton} from '../@components/buttons'
  import {Spinner,Card,Countdown} from '../@components/misc'
  import {getUniqueId, makeValidUrl, duplicatePage} from '../utils'
  import PageItem from './PageList/PageItem.svelte'

  import { modal } from '../@stores/app'
  import {domainInfo,site,pageData,tailwind} from '../@stores/data'

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

  let creatingPage = false

  let pageBeingCreated
  let pageBeingDeleted

  let mounted = false
  onMount(async () => {
    mounted = true
  })

  const validateUrl = ({ detail }) => {
    pageUrl = makeValidUrl(detail)
  }

  let pageUrl = ''

</script>

<ul class="grid grid-cols-2 gap-4">
  {#each $site.pages as page (page.id)}
    <li transition:fade={{ duration: 200 }} id="page-{page.id}">
      <div class="shadow-xl mb-4 rounded">
        <PageItem {page} />
        <div class="w-full flex justify-between px-3 py-2 border-t border-gray-100 ">
          <div on:click={() => modal.hide()}>
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
        <TextInput id="page-title" autofocus={true} variants="mb-4" label="Page Title" placeholder="About Us" />
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