<script>
  import {createEventDispatcher, onMount, getContext} from 'svelte'
  import {fade} from 'svelte/transition'
  import {getStyles,appendHtml} from '../../pageUtils.js'
  import {dependencies} from '@stores/data'
  
  import ComponentButtons from './ComponentButtons.wc.svelte'
  if (!customElements.get('component-buttons')) { 
    customElements.define('component-buttons', ComponentButtons); 
  }


  // import {Component} from './LayoutTypes'

  const active = getContext('editable')

  const dispatch = createEventDispatcher()

  export let row
  export let contentAbove = false
  export let contentBelow = false

  let js
  $: js = row.value.final.js
  $: appendJS(js)

  let mounted = false
  onMount(() => {
    mounted = true
    appendJS(js)
  })

  function appendJS(js) {

    const libraryNames = $dependencies.libraries.map(l => l.name)
    const systemJsLibraries = libraryNames.map(name => `System.import('${name}')`).join(',')

    // TODO: Parse the component's JS to replace es6 import statements with SystemJS import statements
    if (mounted) {
      appendHtml(
        `#component-${row.id} ~ [primo-js]`, 
        'script', 
        libraryNames.length > 0 ? `Promise.all([${systemJsLibraries}]).then(modules => {
          const [${libraryNames.join(',')}] = modules;
          ${js}
        })` : js,
        {
          type: 'module'
        }
      )
    }
  }

</script>


<div class="primo-component" class:active out:fade={{duration:200}} in:fade={{delay:250,duration:200}}>
  {#if active}
    <component-buttons 
      contentabove={contentAbove}
      contentbelow={contentBelow}
      on:edit
      on:delete
      on:addContentBelow
      on:addContentAbove
    ></component-buttons>
  {/if}
  <div id="component-{row.id}">
    {@html row.value.final.html}
  </div>
  <div primo-css>
    {@html getStyles(row.value.final.css)} 
  </div>
  <div primo-js></div>
</div>


<style>
  .primo-component {
    position: relative;
    outline: 2px solid transparent;
    transition: outline 0.2s;
    @apply w-full;

    & > div {
      @apply w-full;
    }
  }
  .primo-component.active:hover {
    outline: 2px solid rgb(206,78,74);
    transition: outline 0.25s;
  }
  .primo-component.active:hover component-buttons {
    @apply opacity-100; 
    user-select: initial;
    pointer-events: none;
  }
  component-buttons {
    @apply absolute opacity-0 top-0 left-0 transition-opacity duration-200;
    z-index: 100;
    user-select: none;
  }
</style>