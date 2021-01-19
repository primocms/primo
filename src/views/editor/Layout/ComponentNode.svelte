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
        `#component-${row.id} > [primo-js]`, 
        'script', 
        js,
        {
          type: 'module'
        }
      )
    }
  }

  let hovering = false
  let sticky = false
  const toolbarHeight = 56

  function handlePositioning() {
    if (buttons) {
      const node = buttons
      const { top } = node.getBoundingClientRect();
      const { top:parentTop, left:parentLeft } = node.parentNode.getBoundingClientRect();
      if (!sticky && top < toolbarHeight && hovering) { 
        node.style.position = 'fixed'
        node.style.top = `${toolbarHeight}px`
        node.style.left = `${parentLeft}px`
        sticky = true
      } else if (parentTop > toolbarHeight || !hovering && sticky) {
        node.style.position = 'absolute'
        node.style.top = '0px'
        node.style.left = '0px'
        sticky = false
      }
    }
  }

  let buttons 
  function handleMouseEnter() {
    hovering = true
    handlePositioning()
  }

</script>

<svelte:window on:scroll={handlePositioning}/>
<div on:mouseenter={handleMouseEnter} on:mouseleave={() => hovering = false} class="primo-component {row.symbolID ? `symbol-${row.symbolID}` : ''}" id="component-{row.id}" out:fade={{duration:200}} in:fade={{delay:250,duration:200}}>
  <component-buttons 
    bind:this={buttons}
    icon={$switchEnabled ? 'code' : 'edit'}
    contentabove={contentAbove}
    contentbelow={contentBelow}
    on:edit
    on:delete
    on:addContentBelow
    on:addContentAbove
  ></component-buttons>
  <div>
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
    outline: 5px solid transparent;
    outline-offset: -5px;
    transition: outline-color 0.2s;
    outline-color: transparent;
    @apply w-full;

    & > div {
      @apply w-full;
    }
  }
  .primo-component:hover {
    outline-color: rgb(206,78,74);
    transition: outline-color 0.2s;
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