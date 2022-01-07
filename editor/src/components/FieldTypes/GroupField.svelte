<script>
  import { find as _find } from 'lodash-es'
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  import fieldTypes from '../../stores/app/fieldTypes';
  import { Card } from '../misc';

  export let field;

</script>

<Card title={field.label}>
  {#each field.fields as subfield}
    <div class="group-item">
      <svelte:component
        this={_find($fieldTypes, ['id', subfield.type]).component}
        field={subfield}
        on:input />
    </div>
  {/each}
</Card>

<style>
  .group-item {
    background: var(--color-gray-9);
    margin-bottom: 0.25rem;
    padding: 0.5rem;
  }

</style>
