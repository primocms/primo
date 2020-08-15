<script lang="ts">
  import {onMount} from 'svelte'
  import { fade } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';
  import {IconButton} from '../misc'
  import _ from 'lodash'

  export let disabled:boolean = false

  const dispatch = createEventDispatcher();

</script>


<div class="field is-horizontal" in:fade={{ duration: 100 }}>
  <div class="field-body">
    <div class="field has-addons">
      <p class="control">
        <span class="select">
          <slot name="type"></slot>
        </span>
      </p>
    </div>
    <div class="field has-addons is-expanded">
      <p class="control">
        <span class="button is-static">
          Label
        </span>
      </p>
      <p class="control is-expanded">
        <slot name="label"></slot>
      </p>
    </div>
    <div class="field is-expanded">
      <div class="field has-addons">
        <p class="control">
          <span class="button is-static">
            ID
          </span>
        </p>
        <p class="control is-expanded">
          <slot name="key"></slot>
        </p>
      </div>
    </div>
    <IconButton icon="times" variants="is-danger is-outlined" on:click={() => dispatch('delete')} {disabled} />
  </div>
</div>
