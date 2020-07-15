<script lang="ts">
  import {Column} from './LayoutTypes'

  export let column:Column
</script>

<div class="column {column.size}" id="column-{column.id}">
  <slot></slot>
</div>