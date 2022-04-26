<script>
  import {cloneDeep} from 'lodash-es'
  import Icon from '@iconify/svelte';
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  import { EditField } from '../../../components/inputs';
  import fieldTypes from '../../../stores/app/fieldTypes'
  import SelectField from '../../../field-types/SelectField.svelte';

  export let field
  export let isFirst
  export let isLast
  export let level = 0

  function validateFieldKey(key) {
    // replace dash and space with underscore
    return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase();
  }

  function dispatchUpdate() {
    dispatch('input', cloneDeep(field))
  }

</script>

<EditField
  {level}
  {isFirst}
  {isLast}
  minimal={field.type === 'info'}
  showDefaultValue={['content', 'number', 'url', 'select', 'text'].includes(field.type)}
  on:delete={() => dispatch('delete', field)}
  on:move={({ detail: direction }) => dispatch('move', { field, direction })}>
  <select
    on:change={({target}) => {
      field = {
        ...field,
        type: target.value,
      }
      dispatchUpdate()
    }}
    value={field.type}
    slot="type">
    {#each $fieldTypes as field}
      <option value={field.id}>{field.label}</option>
    {/each}
  </select>
  <textarea slot="main" class="info" bind:value={field.options.info} />
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
  on:input={() => {
    dispatchUpdate()
    field.key = validateFieldKey(field.key)
  }}
  slot="key" />
  <input
  class="input key-input"
  type="text"
  placeholder="Lorem ipsum"
  bind:value={field.default}
  on:input
  slot="default-value" />
</EditField>
{#each field.fields as subfield, i (subfield.id)}
  <svelte:self 
    field={subfield} 
    isFirst={i === 0}
    isLast={i === field.fields.length - 1}
    on:delete
    on:move
    on:createsubfield
    on:input={({detail:updatedSubfield}) => {
      console.log({updatedSubfield})
      field = {
        ...field,
        fields: field.fields.map(subfield => subfield.id === updatedSubfield.id ? updatedSubfield : subfield)
      }
      dispatchUpdate()
    }}
    level={level+1}
  />
{/each}
{#if field.type === 'select'}
  <SelectField {field} {level} />
{/if}
{#if field.type === 'repeater' || field.type === 'group'}
  <button
    class="field-button subfield-button level-{level}"
    on:click={() => dispatch('createsubfield', field)}
    style:transform="translateX({1.5+level}rem)"
    style:width="calc(100% - {1.5+level}rem)"
  >
    <Icon icon="akar-icons:plus" />
    <span>Create Subfield</span>
  </button>
{/if}

<style lang="postcss">
  select {
    width: 100%;
    border-right: 4px solid transparent;
    background: var(--color-gray-9);
    color: var(--color-gray-2);
    font-size: var(--font-size-2);
    font-weight: 600;
    border: 0;
    padding: 0.5rem !important;
  }
  textarea {
    color: var(--primo-color-black);
    padding: 0.5rem;
  }
  .field-button {
    width: 100%;
    background: var(--button-background);
    color: var(--button-color);
    padding: 0.5rem 0;
    border-bottom-right-radius: var(--border-radius);
    border-bottom-left-radius: var(--border-radius);
    transition: var(--transition-colors);

    display: flex;
    justify-content: center;
    align-items: center;

    span {
      font-weight: 500;
      margin-left: 0.25rem;
    }
  }
  .field-button:hover {
    background: var(--button-hover-background);
  }
  .field-button.subfield-button {
    /* width: calc(100% - 1rem); */
    border-radius: 2px;
    /* margin-left: 1.5rem; */
    margin-top: 8px;
    margin-bottom: 8px;
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

  .input {
    padding: 0.5rem;
  }

  input {
    background: var(--color-gray-8);
    color: var(--color-gray-2);
    padding: 4px;
    border-radius: 2px;
    border: 0;
    padding: 0.5rem;
  }
  input::placeholder {
    color: var(--color-gray-7);
  }
  input:focus {
    outline: 0;
  }
</style>