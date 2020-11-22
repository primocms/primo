<script lang="ts">
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  export let label
  export let value
  export let type:string = 'text'
  export let disabled:boolean = false
  export let variants:string = ''
  export let size:'small'|'medium'|'large' = 'medium'

  function onInput({target}) {
    const {value:inputValue} = target
    if (['text','number','range','password','url'].includes(type)) {
      value = inputValue
    } else {
      console.log('Value not saved:', inputValue)
    } 
    dispatch('input')
  }

</script>

<!-- svelte-ignore a11y-label-has-associated-control -->
<label class="{size} {variants}">
  {#if label}<span>{ label }</span>{/if}
  <input 
    class="input"
    {value}
    {type}
    {disabled}
    {...$$restProps}
    on:input={onInput} 
  >
  <slot></slot>
</label>

<style>
  label {
    @apply flex flex-col font-medium;
  }
  
  label.small {
    @apply text-lg;
  }
  label.small span {
    @apply mb-1 text-xs;
  }
  label.small input {
    @apply px-2 py-1;
  }

  label.medium {
    @apply text-xl;
  }
  label.medium span {
    @apply mb-2 text-sm;
  }
  label.medium input {
    @apply p-2;
  }

  input {
    outline-color: rgb(248,68,73);
    @apply bg-white border-2 border-gray-200;
  }
</style>