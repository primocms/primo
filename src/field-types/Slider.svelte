<script>
  import {Slider} from '../ui'

  export let field
</script>

<div class="w-full">
  <Slider 
    label={field.label}
    bind:value={field.value}
  />
</div>

