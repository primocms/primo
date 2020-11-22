<script>
  export let value
  export let variants = ''
  export let disabled = false
  export let min = null
  export let max = null
  export let step = null
</script>

<input 
  class="input {variants}"
  bind:value
  type="range"
  {disabled}
  {min}
  {max}
  {step}
>

<style>
  input {
    outline-color: rgb(248,68,73);
    @apply bg-white p-2 border-2 border-gray-100;
  }
</style>