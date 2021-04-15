<script>
  import {createEventDispatcher} from 'svelte'
	import { fly } from 'svelte/transition';
  const dispatch = createEventDispatcher()

  let clicked = false
  let submitted = false
  let email = ''
</script>

{#if !clicked}
  <button on:click={() => clicked = true} class="font-medium text-sm px-4 py-2 bg-gray-200 color-gray-900 text-base hover:bg-gray-300 transition-colors duration-200">Invite User</button>
{:else}
  {#if !submitted}
    <form in:fly={{ x:50}} 
    on:submit|preventDefault={() => {
      submitted = true
      dispatch('submit')
    }}>
      <label class="flex items-center">
        <span class="text-base mr-2 text-gray-900">Email:</span>
        <input class="text-base bg-gray-200 text-gray-900 font-medium rounded-sm py-2 px-3" autofocus bind:value={email} type="email" placeholder="johndoe@gmail.com" />
      </label>
    </form>
  {:else}
    <div class="text-base font-medium">Invitation sent to {email}</div>
  {/if}
{/if}
