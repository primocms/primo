<script>
  export let field
</script>

<div class="field">
  <label class="label" for={field.id}>
    { field.label }
    <textarea id={field.id} class="textarea is-medium" bind:value={field.value} on:input></textarea>
  </label>
</div>