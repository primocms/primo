<script lang="ts">
  import {fade} from 'svelte/transition'
  import {Section} from './LayoutTypes'

  export let section:Section;

  let { width } = section

</script>

<div class="section" id="section-{section.id}">
  <div class="flex flex-wrap" class:container={width === 'contained'}>
    <slot></slot>
  </div>
</div>