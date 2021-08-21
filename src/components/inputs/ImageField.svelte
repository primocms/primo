<script>
  import { createEventDispatcher, onMount } from 'svelte';
  const dispatch = createEventDispatcher();
  export let field;

</script>

<div class="flex flex-col p-4 shadow">
  <!-- <span class="text-xl">{field.label}</span> -->
  <label class="flex items-center flex-1">
    <span class="font-semibold text-sm mr-2">Image URL</span>
    <input
      id={field.id}
      bind:value={field.value}
      on:input={() => dispatch('input', field.value)}
      type="url"
      placeholder="https://images.pexels.com/photos/104827/cat-pet-animal-domestic-104827.jpeg" />
  </label>
</div>
<slot />
