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

<style lang="postcss">
  input {
    outline-color: var(--primo-color-brand);
    background: var(--primo-color-black);
    padding: 0.5rem;
    border-bottom: 2px solid rgb(245, 245, 245);
  }

</style>
