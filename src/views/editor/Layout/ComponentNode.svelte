<script>
  import {createEventDispatcher, onMount, getContext} from 'svelte'
  import {fade} from 'svelte/transition'
  import {getStyles,appendHtml} from '../pageUtils.js'
  import {dependencies} from '../../../stores/app/activePage'
  import {switchEnabled} from '../../../stores/app'
  
  import ComponentButtons from './ComponentButtons.wc.svelte'
  if (!customElements.get('component-buttons')) { 
    customElements.define('component-buttons', ComponentButtons); 
  }

  const dispatch = createEventDispatcher()

  export let row
  export let contentAbove = false
  export let contentBelow = false

  let mounted = false
  onMount(() => {
    mounted = true
  })

  $: appendJS(mounted, row.value.final.js)

  function appendJS(mounted, js) {
    if (mounted && js) {
      appendHtml(
        `#component-${row.id} ~ [primo-js]`, 
        'script', 
        js,
        {
          type: 'module'
        }
      )
    }
  }

</script>


<div class="primo-component" out:fade={{duration:200}} in:fade={{delay:250,duration:200}}>
  <component-buttons 
    icon={$switchEnabled ? 'code' : 'edit'}
    contentabove={contentAbove}
    contentbelow={contentBelow}
    on:edit
    on:delete
    on:addContentBelow
    on:addContentAbove
  ></component-buttons>
  <div id="component-{row.id}" class={ row.symbolID ? `symbol-${row.symbolID}` : ''}>
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
    /* outline-offset: -2px; */
    @apply w-full;

    & > div {
      @apply w-full;
    }
  }
  .primo-component:hover {
    outline: 2px solid rgb(206,78,74);
    transition: outline 0.25s;
    z-index: 9;
  }
  .primo-component:hover component-buttons {
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