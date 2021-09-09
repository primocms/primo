<script>
  export let value;
  export let variants = '';
  export let disabled = false;
  export let min = null;
  export let max = null;
  export let step = null;

</script>

<input
  class="input {variants}"
  bind:value
  type="range"
  {disabled}
  {min}
  {max}
  {step} />

<style>
  input {
    outline-color: rgb(248, 68, 73);
    background: white;
    padding: 0.5rem;
    border-bottom: 2px solid rgb(245, 245, 245);
  }

</style>
