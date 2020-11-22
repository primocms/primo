<script>
  export let field
</script>

<label class="flex flex-col w-full" for={field.key}>
  <span for={field.key}>{field.label}</span>
  <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
    <input type="checkbox" id={field.key} on:input bind:checked={field.value} class="toggle-checkbox outline-none absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
    <span class="toggle-label outline-none block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></span>
  </div>
</label>


<style>
  input:checked {
    @apply right-0 border-blue-500;
    transition: right 0.2s;
  }
  input:checked + span {
    @apply bg-blue-500;
  }
</style>
                 
