<script>
  import {TextField} from '../ui'

  export let field
</script>

<div class="w-full">
  <TextField 
    {...field} 
    on:input
    bind:value={field.value}
    type="number"
  />
</div>

