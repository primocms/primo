<!-- <svelte:options tag='block-buttons' /> -->
<script>
  import Mousetrap from 'mousetrap'

  import {code, trash, edit} from '../../../components/svg/small'

  import { createEventDispatcher, onMount } from "svelte"
  import {fade} from 'svelte/transition' 
  import { content } from '../../../stores/app/activePage';
  import {switchEnabled} from '../../../stores/app'

  let modKeydown = false
  Mousetrap.bind('mod', () => {
    modKeydown = true
  }, 'keydown');
  Mousetrap.bind('mod', () => {
    modKeydown = false
  }, 'keyup');
  Mousetrap.bind('mod+e', () => {
    dispatch('edit')
  }, 'keydown');
  const dispatch = createEventDispatcher()

  export let i
  export let optionsAbove
  export let optionsBelow
  export let node = null

  export let editable

  const iconStyles = `width:15px;position: relative;top: 1px;fill:#f7fafc;`

  $: isFirst = i === 0
  $: isLast = i === $content.length -1

</script>

<div in:fade={{ duration: 100 }} class="block-buttons" class:editable class:is-content={!editable} bind:this={node}>
  <div class="top">
      <div class="component-button">
        {#if editable}
        <button on:click={() => dispatch('edit')} class="button-span">
          {#if modKeydown}
            <span>&#8984; E</span>
          {:else}
            {#if $switchEnabled}
              {@html code(iconStyles)}    
            {:else}
              {@html edit(iconStyles)}    
            {/if}
            <span>Edit</span>
          {/if}
        </button>
        {/if}
        <button on:click={() => dispatch('delete')} class="button-delete">
          {@html trash(`${iconStyles}`)}    
        </button>
      </div>
    <div class="component-svg">
      {#if !isFirst}
        <button class="button-moveup-down" on:click={() => dispatch('moveUp')} >
          <svg class="svg-moveup" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>
        </button>
      {/if}
      {#if !optionsAbove}
        <button on:click={() => dispatch('addOptionsAbove')} style=" padding-left: 1rem padding-right: 1rem" class:rounded-bl={isFirst}>
          <!-- {@html chevron(iconStyles)}     -->
          <svg style="width: 1rem height: 1rem" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"></path></svg>
        </button>
      {/if}
    </div>
  </div>
  <div class="bottom">
    {#if !isLast}
      <button class="button-moveup-down" on:click={() => dispatch('moveDown')} >
        <svg class="svg-movedown" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>
      </button>
    {/if}
    {#if !optionsBelow}
      <button on:click={() => dispatch('addOptionsBelow')} style="padding-left: 1rem padding-right: 1rem" class:rounded-tl={isLast}>
        <!-- {@html chevron(`${iconStyles}transform: scaleY(-1)`)}     -->
        <svg style="width: 1rem height: 1rem" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"></path></svg>
      </button>
    {/if}
  </div>
</div>

<style>

  .block-buttons {
    box-shadow: inset 0 0 0 calc(4px) rgb(248,68,73);
     z-index: 10;
     position: absolute;
     pointer-events: none;
     inset: 0px;
     /* top: 0px;
     left: 0px;
     right: 0px;
     bottom: 0px; */
  }

  .is-content {
    box-shadow: inset 0 0 0 calc(4px) rgba(248,68,73,0.1);
  }
  .component-button{
    display: flex;
    left: 0px;
  }
  .button-delete{
    border-bottom-right-radius: 0.25rem/* 4px */;
    padding-left: 0.75rem/* 12px */;
    padding-right: 0.75rem/* 12px */;
  }
  .button-span{
    border-right-width: 1px;
    border-color: rgba(239, 68, 68, var(--tw-border-opacity));
    padding-left: 0.5rem/* 8px */;
    padding-right: 0.5rem/* 8px */;
  }

  button {
    pointer-events: all;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 2rem/* 32px */;
    background-color: rgba(248, 68, 73, var(--tw-bg-opacity));
    font-size: 0.875rem/* 14px */;
    line-height: 1.25rem/* 20px */;
    font-weight: 500;
    color: rgba(245, 245, 245, var(--tw-text-opacity));
    transition-property: background-color, border-color, color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
    transition-duration: 100ms; /* do we still need this */
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);

    &:hover {
      background-color: rgba(220, 38, 38, var(--tw-bg-opacity));
    }
  }
  button:focus{
    outline: 2px solid transparent;
    outline-offset: 2px;
  }

  .top {
    display: flex;
    justify-content: space-between;
    position: absolute;
    width: 100%;
    /* left: 0px;
    right: 0px;
    top: 0px; */
    inset: 0px;
  }
  .component-svg {
    display: flex;
    position: absolute;
    right: 0px;
  }
  .button-moveup-down {
    border-bottom-left-radius: 0.25rem/* 4px */;
    border-right-width: 1px;
    border-color: rgba(239, 68, 68, var(--tw-border-opacity));
    padding-left: 0.5rem/* 8px */;
    padding-right: 0.5rem/* 8px */;

  }
  .svg-moveup {
   width: 1.25rem/* 20px */;
   height: 1.25rem/* 20px */;
  }
  .svg-movedown {
   --tw-translate-x: 0;
   --tw-translate-y: 0;
   --tw-rotate: 0;
   --tw-skew-x: 0;
   --tw-skew-y: 0;
   --tw-scale-x: 1;
   --tw-scale-y: 1;
   --tw-rotate: 180deg;
   width: 1.25rem/* 20px */;
   height: 1.25rem/* 20px */;
   transform: translateX(var(--tw-translate-x)) translateY(var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));
}
  .bottom {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    bottom: 0px;
    right: 0px;
    position: absolute;
  }
  span{
    margin-left: 0.5rem/* 8px */;
  }

</style>