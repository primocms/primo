<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  import autosize from 'autosize';
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

  let element;

  $: if (element) {
    autosize(element);
  }

</script>

<label for={field.id}>
  <span>{field.label}</span>
  <textarea
    id={field.id}
    bind:this={element}
    bind:value={markdown}
    on:input={parseContent} />
</label>

<style lang="postcss">
  label {
    display: flex;
    flex-direction: column;
    margin-bottom: 0.5rem;
    font-weight: 500;

    span {
      margin-bottom: 0.5rem;
    }

    textarea {
      outline: 0 !important;
      background: var(--color-gray-8);
      padding: 0.5rem;
      border: 0;

      &:focus {
        box-shadow: var(--ring);
      }
    }
  }

</style>
