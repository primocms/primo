<script>
  import { TextField } from '../ui';

  export let field;

</script>

<div>
  <TextField {...field} on:input bind:value={field.value} type="url" />
</div>

<style lang="postcss">
  div {
    width: 100%;
  }

</style>
