<script>
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  import showdown from 'showdown'
  const converter = new showdown.Converter();

  export let field

  function parseContent() {
    const html = converter.makeHtml(markdown);
    field.value = html
    dispatch('input')
  }

  let markdown = typeof field.value === 'string' ? converter.makeMarkdown(field.value) : ''
</script>

<label class="label" for={field.id}>
  <span>{ field.label }</span>
  <textarea id={field.id} rows="8" bind:value={markdown} on:input={parseContent}></textarea>
</label>

<style>
  .label {
    @apply flex flex-col mb-2 font-medium;
  }

  .label span {
      @apply mb-2;
    }

  .label textarea {
    @apply p-2 bg-gray-800;
    outline-color: rgb(248,68,73);
  }
</style>