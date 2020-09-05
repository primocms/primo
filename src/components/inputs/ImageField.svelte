<script>
  import { createEventDispatcher, onMount } from 'svelte'
  const dispatch = createEventDispatcher()

  import { domainInfo } from '../../stores/data'
  import { get } from 'svelte/store'

  import {getUniqueId} from '../../utils.js'

  export let field
  
</script>

<div class="flex flex-col p-4 shadow mb-2">
  <span class="text-xl">{field.label}</span>
  <label class="flex items-center flex-1">
    <span class="font-semibold text-sm mr-2">Image URL</span>
    <input bind:value={field.value} on:input={() => dispatch('input', field.value)} class="bg-gray-200 p-2 flex-1" type="url" placeholder="https://images.pexels.com/photos/104827/cat-pet-animal-domestic-104827.jpeg">
  </label>
</div>
<slot></slot>
