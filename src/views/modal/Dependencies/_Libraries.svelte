<script>
  import axios from 'axios'
  import _ from 'lodash'
  import {fade} from 'svelte/transition'
  import {IconButton} from '../../../components/buttons'

  import LibraryCard from './LibraryCard.svelte'

  export let libraries

  async function addPackage(pack) {
    libraries = [ ...libraries, pack ] // set immediately, then update with details
    const {data} = await axios.get(`https://data.jsdelivr.com/v1/package/npm/${pack.name}@${pack.version}`) // get library endpoint
    const src = getLibrarySrc(pack, data)
    const type = getLibraryType(src)
    libraries = libraries.map(library => {
      if (library.name === pack.name) {
        return {
          ...pack,
          used: true,
          type,
          src,
          valid: (type === 'js' || type === 'css'), 
        }
      } else return library
    }) 
  }

  function getLibraryType(src) {
    if (src) {
      const srcArray = src.split('.')
      const extension = srcArray[srcArray.length-1]
      return extension
    } else {
      return null
    }
  }

  function getLibrarySrc(pack, data) {
    const { name, version } = pack
    let { default:main } = data
    if (main === '/dist') main = '/dist/index.js'
    return main ? `https://cdn.jsdelivr.net/npm/${name}@${version}${main}` : null
  }

  function removePackage(name) {
    libraries = libraries.filter(l => l.name !== name)
  }

  let searching = false
  async function searchForPackages() {
    searching = true
    const {data} = await axios.get(`https://registry.npmjs.com/-/v1/search?text=${packageName}`)
    searching = false
    searchResults = data.objects.map(d => d.package)
  }

  let searchResults = []
  $: parsedResults = searchResults.slice(0, 20).map(r => ({
    name: r.name,
    author: r.author ? r.author.name : null,
    description: r.description ? r.description : null,
    links: Object.entries(r.links).map(l => ({ site: l[0], href: l[1] })),
    version: r.version,
    date: r.date,
    used: _.some(libraries, ['name', r.name])
  }))

  let packageName = ''

  let customScript = ''

  // function addCustomScript() {
  //   customScripts = [ ...customScripts, { src: customScript } ]
  //   customScript = ''
  // }

  // function removeCustomScript(src) {
  //   customScripts = customScripts.filter(script => script.src !== src)
  // }


</script>
  
{#if libraries.length > 0}
  Included libraries
  <ul class="list is-hoverable">
    {#each libraries as library, i}
      <LibraryCard 
        {library} 
        {i} 
        valid={library.valid}
        button={{
          label: 'Remove',
          onclick: () => {
            removePackage(library.name)
          }
        }} 
      />
    {/each}
  </ul>
{/if}

Add a library
<form class="flex mt-2" on:submit|preventDefault={searchForPackages}>
  <input class="flex-1 bg-gray-100 p-2 focus:outline-none" type="text" placeholder="alpinejs" bind:value={packageName}>
  <IconButton variants="px-4 bg-gray-900 text-gray-100" disabled={searching} icon={searching ? "spinner" : "search"}/>
</form>

<ul class="list is-hoverable">
  {#each parsedResults as library, i}
    <LibraryCard 
      {library} 
      {i} 
      button={library.used ? null : {
        label: 'Use',
        onclick: () => {
          addPackage(library)
        }
      }} 
    />
  {/each}
</ul>

<style>
  .list {
    margin-top: 0.5rem;
  }
  .list {
    margin-bottom: 1rem;
  }
</style>