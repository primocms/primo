<script>
  import { processCode } from '../../utils';
  import { convertFieldsToData } from '../../utils';

  export let field;
  export let fields;
  export let onChange;

  onChange = () => {
    buildComponent(field.value);
  };

  let c;
  async function buildComponent(source) {
    const data = convertFieldsToData(fields);
    const res = await processCode({
      code: {
        html: source,
        css: '',
        js: '',
      },
      data,
      buildStatic: false,
    });
    const blob = new Blob([res.js], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);

    import(url).then(({ default: App }) => {
      if (c) c.$destroy();
      try {
        c = new App({
          target: element,
          props: data,
        });
      } catch (e) {
        console.error(e.toString());
      }
    });
  }
  $: buildComponent(field.value);

  let element;

</script>

<div bind:this={element} />
