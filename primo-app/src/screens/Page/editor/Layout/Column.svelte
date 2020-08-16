<script lang="ts">
  import type {Column} from './LayoutTypes'

  export let column:Column
</script>

<div class="column {column.size}" id="column-{column.id}">
  <slot></slot>
</div>

<style>
  .column {
    outline: 1px solid transparent;
    outline-color: transparent;
    transition: 0.25s outline-color;
  }
  .column:hover {
    outline-color: gainsboro;
    transition: 0.25s outline-color;
  }
</style>