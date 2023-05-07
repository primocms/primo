<script context="module">
  import showdown from '../libraries/showdown/showdown.min.js'
  import showdownHighlight from 'showdown-highlight'
  export const converter = new showdown.Converter({
    extensions: [showdownHighlight()],
  })
</script>

<script>
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
  import autosize from 'autosize'

  export let field

  // ensure value is correct shape
  if (typeof field.value === 'string') {
    field.value = {
      markdown: converter.makeMarkdown(field.value),
      html: field.value,
    }
  } else if (
    typeof field.value !== 'object' &&
    !field.value.hasOwnProperty('markdown')
  ) {
    field.value = {
      markdown: '',
      html: '',
    }
  }

  let value = field.value.markdown
  $: parseContent(value)

  let element

  $: if (element) {
    // grow textarea to size of content
    autosize(element)
  }

  // easily delete default content
  function selectAll({ target }) {
    if (field.default === field.value.markdown) target.select()
  }

  function parseContent(markdown) {
    field.value.html = converter.makeHtml(markdown)
    field.value.markdown = markdown
    dispatch('input')
  }

  function handleSave({ metaKey, key }) {
    if (metaKey && key === 's') {
      dispatch('save')
    }
  }
</script>

<label for={field.id}>
  <span>{field.label}</span>
  <textarea
    id={field.id}
    on:focus={selectAll}
    on:keydown={handleSave}
    on:input={({ target }) => parseContent(target.value)}
    {value}
    bind:this={element}
  />
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
      background: var(--input-background, #2a2b2d);
      border: var(--input-border, 1px solid #3e4041);
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
