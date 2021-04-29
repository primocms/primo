<script>
  import axios from 'axios'
  import { createEventDispatcher } from 'svelte'
  import { makeValidUrl } from '../utils'
  const dispatch = createEventDispatcher()

  import TextInput from '../components/inputs/TextInput.svelte'

  export let field = {
    value: {
      title: '',
      url: '',
      active: false
    }
  }

  $: if (typeof field.value === 'string' || !field.value) {
    field.value = {
      title: '',
      url: '',
      active: false
    }
  }

  $: field.value.url = makeValidUrl(field.value.url)
  
</script>

<div class="flex flex-col">
  <span class="text-xs font-semibold">{field.label}</span>
  <div class="flex flex-col w-full">
    <TextInput
      on:input
      bind:value={field.value.title}
      id="page-label"
      autofocus={true}
      variants="mb-2"
      label="Title"
      placeholder="About Us" />
    <TextInput
      on:input
      bind:value={field.value.url}
      autofocus={true}
      variants="mb-2"
      label="URL"
      placeholder="about-us" />
  </div>
</div>
<slot></slot>

<style>

</style>