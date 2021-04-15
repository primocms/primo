<script>
  import {cloneDeep} from 'lodash'
  import {onMount} from 'svelte'
  import {fade} from 'svelte/transition'
	import { router } from 'tinro';
  import {getStyles,appendHtml} from '../pageUtils.js'
  import {processors} from '../../../component'
  import {getAllFields,getTailwindConfig} from '../../../stores/helpers'
  import components from '../../../stores/app/components'
  import {
    convertFieldsToData
  } from "../../../utils";

  export let block

  let mounted = false
  onMount(() => mounted = true)

  $: appendJS(block.value.js, mounted)
  function appendJS(js, mounted) {
    if (mounted && js) {
      const allFields = getAllFields(block.value.fields)
      const data = convertFieldsToData(allFields)
      const finalJS = `
        const primo = {
          id: '${block.id}',
          data: ${JSON.stringify(data)},
          fields: ${JSON.stringify(allFields)}
        }
        ${js.replace(/(?:import )(\w+)(?: from )['"]{1}(?!http)(.+)['"]{1}/g,`import $1 from 'https://cdn.skypack.dev/$2'`)}`
      appendHtml(
        `#component-${block.id} > [primo-js]`, 
        'script', 
        finalJS,
        {
          type: 'module'
        }
      )
      $components[js] = finalJS
    }
  }


  let html = ''
  $: processHTML(block.value.html)
  function processHTML(raw = '') {
    const cacheKey = raw + JSON.stringify(block.value.fields) // to avoid getting html cached with irrelevant data
    const cachedHTML = $components[cacheKey]
    if (!block.symbolID && cachedHTML) {
      html = cachedHTML
    } else {
      const allFields = getAllFields(block.value.fields);
      const data = convertFieldsToData(allFields);
      processors.html(raw, data).then(res => {
        html = res
        $components[cacheKey] = html
      })
    }
  }

  let css = ''
  $: processCSS(block.value.css)
  function processCSS(raw = '') {
    const cacheKey = block.id + raw // to avoid getting html cached with irrelevant data
    const cachedCSS = $components[cacheKey]
    if (cachedCSS) {
      css = cachedCSS
    } else if (raw) {
      const tailwind = getTailwindConfig(true)
      const encapsulatedCss = `#component-${block.id} {${raw}}`;
      processors.css(encapsulatedCss, { tailwind }).then(res => {
        css = res
        $components[cacheKey] = css
      })
    } else {
      css = ``
    }
  }

</script>

<div class="component {block.symbolID ? `symbol-${block.symbolID}` : ''}" id="component-{block.id}" transition:fade={{duration:100}}>
  <div>
    {@html html}
  </div>
  <div primo-css>
    {@html getStyles(css)} 
  </div>
  <div primo-js></div>
</div>


<style>
  .component {
    position: relative;
    outline: 5px solid transparent;
    outline-offset: -5px;
    transition: outline-color 0.2s;
    outline-color: transparent;
    @apply w-full;
  }
  .component > div {
      @apply w-full;
    }
</style>