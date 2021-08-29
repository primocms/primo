<script>
  import CodeMirror from '../../components/CodeEditor/CodeMirror.svelte';
  import { processCode } from '../../utils';
  import { convertFieldsToData } from '../../utils';
  import { getAllFields } from '../../stores/helpers';

  export let field;

  let c;
  async function buildComponent(source) {
    const data = convertFieldsToData(
      getAllFields([], (f) => f.id !== field.id)
    );
    const res = await processCode({
      code: {
        html: source,
        css: '',
        js: '',
      },
      data,
      buildStatic: false,
    });
    error = res.error;
    if (!error) {
      const blob = new Blob([res.js], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const { default: App } = await import(url);
      if (c) c.$destroy();
      try {
        c = new App({
          target: element,
          props: data,
        });
      } catch (e) {
        console.error(e.toString());
      }
    }
  }

  let element;
  let error;

  $: element && buildComponent(field.value);

</script>

<CodeMirror bind:value={field.value} />
{#if error}
  <pre>
    {@html error}
  </pre>
{/if}
<div bind:this={element} />

<style>
  pre {
    margin: 0;
    padding: 1rem;
    background: var(--primo-color-black);
    color: var(--color-gray-3);
    border: 1px solid var(--color-gray-6);
  }

</style>
