<script>
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  import { EditField } from '../../../components/inputs';
  import fieldTypes from '../../../stores/app/fieldTypes';
  import RepeaterField from '../../../components/FieldTypes/RepeaterField.svelte';
  import GroupField from '../../../components/FieldTypes/GroupField.svelte';

  export let field
  export let isFirst
  export let isLast

  const allFieldTypes = [
    {
      id: 'repeater',
      label: 'Repeater',
      component: RepeaterField,
    },
    {
      id: 'group',
      label: 'Group',
      component: GroupField,
    },
    ...$fieldTypes,
  ];

  function validateFieldKey(key) {
    // replace dash and space with underscore
    return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase();
  }

</script>

<EditField
  {isFirst}
  {isLast}
  minimal={field.type === 'info'}
  on:delete={() => dispatch('delete', field.id)}
  on:move={({ detail: direction }) => dispatch('move', { field, direction })}>
  <select
    bind:value={field.type}
    slot="type">
    {#each allFieldTypes as field}
      <option value={field.id}>{field.label}</option>
    {/each}
  </select>
  <textarea slot="main" class="info" bind:value={field.value} />
  <input
    class="input label-input"
    type="text"
    placeholder="Heading"
    bind:value={field.label}
    slot="label" />
  <input
  class="input key-input"
  type="text"
  placeholder="heading"
  bind:value={field.key}
  on:input={() => (field.key = validateFieldKey(field.key))}
  slot="key" />
</EditField>
{#each field.fields as subfield, i (subfield.id)}
  <svelte:self 
    field={subfield} 
    {i} 
    isFirst={i === 0}
    isLast={i === field.fields.length - 1}
    on:delete={() => dispatch('delete', subfield.id)}
    on:move
    on:createsubfield
  />
{/each}
{#if field.type === 'repeater' || field.type === 'group'}
  <button
    class="field-button subfield-button"
    on:click={() => dispatch('createsubfield', field)}><i class="fas fa-plus" />Create Subfield</button>
{/if}

<style lang="postcss">
  select {
    width: 100%;
    padding: 8px;
    border-right: 4px solid transparent;
    background: var(--color-gray-9);
    color: var(--color-gray-2);
    font-size: var(--font-size-2);
    font-weight: 600;
    border: 0;
  }
  .field-button {
    width: 100%;
    background: var(--color-gray-8);
    color: var(--color-gray-3);
    padding: 8px 0;
    border-bottom-right-radius: var(--border-radius);
    border-bottom-left-radius: var(--border-radius);
    transition: var(--transition-colors);

    i {
      margin-right: 0.5rem;
    }
  }
  .field-button:hover {
    background: var(--color-gray-9);
  }
  .field-button.subfield-button {
    width: calc(100% - 1rem);
    border-radius: 2px;
    margin-left: 1.5rem;
    margin-top: 8px;
    font-size: var(--font-size-2);
    background: var(--primo-color-codeblack);
    color: var(--color-gray-2);
    transition: var(--transition-colors);
    outline: 0;
  }
  .field-button.subfield-button:hover {
    background: var(--color-gray-9);
  }
  .field-button.subfield-button:focus {
    background: var(--color-gray-8);
  }

  input {
    background: var(--color-gray-7);
    color: var(--color-gray-2);
    padding: 4px;
    border-radius: 2px;
    border: 0;
    padding: 0.5rem;
  }
  input:focus {
    outline: 0;
  }
</style>