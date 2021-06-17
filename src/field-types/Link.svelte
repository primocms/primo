<script>
  import axios from 'axios';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  import TextInput from '../components/inputs/TextInput.svelte';

  export let field = {
    value: {
      label: '',
      url: '',
      active: false,
    },
  };

  $: if (typeof field.value === 'string' || !field.value) {
    field.value = {
      label: '',
      url: '',
      active: false,
    };
  } else if (field.value.title && !field.value.label) {
    // Fix old values using `title` instead of `label`
    field.value = {
      ...field.value,
      label: field.value.title,
    };
  }

</script>

<div class="flex flex-col">
  <span class="text-xs font-semibold">{field.label}</span>
  <div class="flex flex-col w-full">
    <TextInput
      on:input
      bind:value={field.value.label}
      id="page-label"
      variants="mb-2"
      label="Label"
      placeholder="About Us" />
    <TextInput
      on:input
      bind:value={field.value.url}
      variants="mb-2"
      label="URL"
      type="url"
      placeholder="about-us" />
  </div>
</div>
<slot />
