<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  import showdown from 'showdown';
  const converter = new showdown.Converter();

  export let field;

  function parseContent() {
    const html = converter.makeHtml(markdown);
    field.value = html;
    dispatch('input');
  }

  let markdown =
    typeof field.value === 'string' ? converter.makeMarkdown(field.value) : '';

</script>

<label for={field.id}>
  <span>{field.label}</span>
  <textarea
    id={field.id}
    rows="8"
    bind:value={markdown}
    on:input={parseContent} />
</label>

<style>
  label {
    display: flex;
    flex-direction: column;
    margin-bottom: 0.5rem;
    font-weight: 500;

    span {
      margin-bottom: 0.5rem;
    }

    textarea {
      outline-color: rgb(248, 68, 73);
      background: var(--color-gray-8);
      padding: 0.5rem;
      border: 0;
    }
  }

</style>
