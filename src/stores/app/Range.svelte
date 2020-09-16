<script>
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let field

  export let disabled = false
  export let title = null;

  let isCheckbox
  $: isCheckbox = field.type === 'checkbox' 

  function onInput({ target }) {
    field.value = isCheckbox ? target.checked : target.value;
    dispatch('input')
  }

</script>

<label class="flex flex-col text-xl font-medium p-4 shadow-sm mb-2">
  <span class="mb-2">{ field.label }</span>
  <input type="range">
</label>

<style>

</style>