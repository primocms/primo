<script>
  import { find as _find, chain as _chain } from 'lodash-es'
  import fieldTypes from '../../stores/app/fieldTypes';
  import { Card } from '../misc';
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  export let field;

  function setFieldValue() {
    field.value = _chain(field.fields).keyBy('key').mapValues('value').value()
  }

  function onInput() {
    setFieldValue()
    dispatch('input');
  }

</script>

<Card title={field.label}>
  {#each field.fields as subfield}
    <div class="group-item">
      <svelte:component
        this={_find($fieldTypes, ['id', subfield.type]).component}
        field={subfield}
        on:input={onInput} />
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
