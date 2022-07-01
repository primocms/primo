<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  import autosize from 'autosize';
  import showdown from '../libraries/showdown/showdown.min.js';
  const converter = new showdown.Converter();

  export let field;

  // ensure options has correct shape
  if (!field?.options?.markdown) {
    field.options = {
      markdown: converter.makeMarkdown(field.value) || ''
    }
  }

  // ensure value is a string
  if (field.value !== 'string') {
    field.value = ''
  }

  let value = field.options.markdown
  $: parseContent(value)

  let element;

  $: if (element) {
    // grow textarea to size of content
    autosize(element);
  }

  // easily delete default content 
  function selectAll({target}) {
    if (field.default === field.value) target.select()
  }

  function parseContent(markdown) {
    field.value = converter.makeHtml(markdown);
    field.options.markdown = markdown
    dispatch('input');
  }

</script>

<label for={field.id}>
  <span>{field.label}</span>
  <textarea
    id={field.id}
    on:focus={selectAll}
    bind:value
    bind:this={element} />
</label>

<style lang="postcss">
  label {
    display: flex;
    flex-direction: column;
    margin-bottom: 0.5rem;
    font-weight: 500;

    span {
      margin-bottom: 1rem;
      font-size: var(--label-font-size);
      font-weight: var(--label-font-weight);
    }

    textarea {
      background: var(--input-background, #2A2B2D);
      border: var(--input-border, 1px solid #3E4041);
      border-radius: 4px;
      font-size: 0.875rem;
      outline: 0 !important;
      transition: 0.1s border;
      padding: 0.75rem 1rem;

      &:focus {
        border-color: #646668;
      }
    }
  }

</style>
