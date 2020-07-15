<script lang="ts">
  import ShortUniqueId from "short-unique-id";
  import Firestore from '@fb/firestore'
  import { addSiteToUser, getUserSites, removeSiteFromUser, addDomainToUser, addSubdomainToUser, getUserDomains, getUserSubdomains, deleteSubdomainFromUser } from '@fb/firestore/users'
  import {registerSubdomain,deregisterSubdomain} from '@fb/firestore/domains'
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { MODAL_TYPES } from 'const'
  import SubdomainItem from './SubdomainItem.svelte'
  import {Spinner,Tabs} from '@components/misc'

  import {modal} from '@stores/app'

  type Subdomain = {
    id: string,
    data: {
      registration: null,
      role: 'editor' | 'developer'
    }
  }


  let domainName:string = ''

  async function deleteSubdomain(subdomain:string): Promise<any> {
    subdomains = subdomains.filter(s => s.id !== subdomain)
    await deregisterSubdomain(subdomain)
    await deleteSubdomainFromUser(subdomain)
  }


  let subdomains:Array<Subdomain> = []

  let subdomain:string = ''
  let loading:boolean = false

  let subdomainBeingDeleted:any = false
  let deletionProgress:number = 0
  let countdown

  function beginDeletion(subdomain:string): void {
    subdomainBeingDeleted = subdomain
    countdown = setInterval(() => {
      if (deletionProgress < 1000) deletionProgress++
      else {
        deleteSubdomain(subdomain)
        resetDeletion()
      }
    }, 1)
  }

  function resetDeletion(): void {
    subdomainBeingDeleted = null
    deletionProgress = 0
    clearInterval(countdown)
  }

  function beginInvitation(domain): void {
    modal.show('INVITATION', { domain })
  }

  function createSubdomain(): void {
    modal.show('SUBDOMAIN_CREATION')
  }

</script>

<Firestore on:load={async() => {
  subdomains = await getUserSubdomains()
}}/>

<div class="pt-4 bg-white px-4 pb-4 rounded shadow-lg" in:fade>
  <div class="sites">
    {#each subdomains as subdomain, i (subdomain.id)}
      {#if subdomainBeingDeleted === subdomain.id}
        <div class="text-2xl flex flex-row justify-between items-center py-4 my-4 shadow-sm px-6 transition-colors duration-200" in:fade={{ duration: 100 }}>
          <div class="flex-1 mr-8">
            <p class="text-xl font-bold">
              Deleting {subdomain.id}
            </p>
            <progress class="progress is-small is-danger my-2" value="{deletionProgress}" max="1000"></progress>
          </div>
          <button on:click={resetDeletion} class="text-xs bg-blue-100 text-blue-900 px-4 py-2 rounded hover:bg-blue-200 transition-colors duration-200">Undo</button>
        </div>
      {:else}
        <SubdomainItem 
          {subdomain} 
          on:invite={() => beginInvitation(subdomain.id)}
          on:delete={() => beginDeletion(subdomain.id)} 
        />
      {/if}
    {/each}
  </div>

  {#if subdomains.length <= 20 }
    <button
      class="w-full py-2 bg-gray-900 text-gray-200 rounded mt-2 font-medium hover:bg-gray-800 transition-colors duration-200"
      on:click={createSubdomain}
      >
      create a site
    </button>
  {/if}

</div>


<style>

  .sites {
    @apply grid gap-2;
  }

  @screen md {
    .sites {
      grid-template-columns: 1fr 1fr;
    }
  }

  .text-input {
    @apply text-base bg-gray-200 text-gray-900 font-medium rounded-sm py-2 px-3 flex-1 w-full;
  }
  button[disabled] {
    @apply bg-blue-300 cursor-not-allowed transition-colors duration-200;
  }

  progress {
    /* @apply mx-8 my-0 !important; */
  }

</style>