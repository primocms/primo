<script>
  import { find as _find, chain as _chain } from 'lodash-es'
  import { Card } from '../components/misc';
  import {fieldTypes} from '../stores/app'
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

  function getFieldComponent(subfield) {
    const field = _find($fieldTypes, ['id', subfield.type])
    return field ? field.component : null
  }
  
</script>

<Card title={field.label}>
  {#each field.fields as subfield}
    <div class="group-item">
      <svelte:component
        this={getFieldComponent(subfield)}
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
