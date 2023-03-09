<script>
  import { cloneDeep, chain as _chain, isEqual } from 'lodash-es'
  import Icon from '@iconify/svelte'
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  import { EditField } from '../../../components/inputs'
  import fieldTypes from '../../../stores/app/fieldTypes'
  import SelectField from '../../../field-types/SelectField.svelte'
  import { getPlaceholderValue, getEmptyValue } from '../../../utils'

  export let field
  export let isFirst
  export let isLast
  export let level = 0
  export let options = []
  export let top_level = true

  function validateFieldKey(key) {
    // replace dash and space with underscore
    return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase()
  }

  function dispatchUpdate() {
    // prevent fields from being saved with invalid values
    const updated_field = cloneDeep(field)
    const value_is_valid = validateFieldValue(updated_field)
    if (!value_is_valid) {
      updated_field.value = getPlaceholderValue(field)
    }
    dispatch('input', updated_field)
  }

  // Ensure fields have an initial value, in case the field is created & no value is set
  function validateFieldValue(field) {
    if (!('value' in field)) return false
    else if (field.type === 'repeater') {
      const desired_shape = getRepeaterShape(field.fields)
      const current_shape = getRepeaterShape(field.fields)
      console.log({ desired_shape, current_shape })
      return isEqual(desired_shape, current_shape)
    } else if (field.type === 'group') {
      if (typeof field.value !== 'object') return false
      const desired_shape = getGroupShape(field)
      const current_shape = getGroupShape(field)
      return isEqual(desired_shape, current_shape)
    } else if (field.type === 'image')
      return (
        typeof field.value === 'object' &&
        'url' in field.value &&
        'alt' in field.value
      )
    else if (field.type === 'text') return typeof field.value === 'string'
    else if (field.type === 'content') return typeof field.value === 'string'
    else if (field.type === 'link')
      return (
        typeof field.value === 'object' &&
        'url' in field.value &&
        'label' in field.value
      )
    else if (field.type === 'url') return typeof field.value === 'string'
    else return true // future field types true until accounted for

    function getRepeaterShape(subfields) {
      return Array.from(Array(2)).map((_) =>
        _chain(subfields)
          .keyBy('key')
          .mapValues((subfield) => typeof subfield.value)
          .value()
      )
    }

    function getGroupShape(field) {
      return _chain(field.fields)
        .keyBy('key')
        .mapValues((field) => typeof field.value)
        .value()
    }
  }

  $: visibilityOptions = field.fields
    .filter((f) => f.type === 'select')
    .map((f) => ({
      label: f.label,
      key: f.key,
      options: f.options.options || [],
    }))
</script>

<EditField
  {level}
  {isFirst}
  {isLast}
  {top_level}
  bind:is_static={field.is_static}
  minimal={field.type === 'info'}
  showDefaultValue={['content', 'number', 'url', 'select', 'text'].includes(
    field.type
  )}
  showVisibilityOptions={field.type !== 'select' && options.length > 0
    ? options
    : false}
  on:delete={() => dispatch('delete', field)}
  on:move={({ detail: direction }) => dispatch('move', { field, direction })}
>
  <select
    on:change={({ target }) => {
      field = {
        ...field,
        type: target.value,
      }
      dispatchUpdate()
    }}
    value={field.type}
    slot="type"
  >
    {#each $fieldTypes as field}
      <option value={field.id}>{field.label}</option>
    {/each}
  </select>
  <textarea
    slot="main"
    class="info"
    value={field.options.info}
    on:input={({ target }) => {
      field.options.info = target.value
      dispatchUpdate()
    }}
  />
  <input
    class="input label-input"
    type="text"
    placeholder="Heading"
    bind:value={field.label}
    slot="label"
  />
  <input
    class="input key-input"
    type="text"
    placeholder="heading"
    value={field.key}
    on:input={({ target }) => {
      field.key = validateFieldKey(target.value)
      dispatchUpdate()
    }}
    slot="key"
  />
  <input
    class="input key-input"
    type="text"
    placeholder="Lorem ipsum"
    value={field.default}
    on:input={({ target }) => {
      field.default = target.value
      dispatchUpdate()
    }}
    slot="default-value"
  />
  <select
    on:change={({ target }) => {
      field = {
        ...field,
        options: {
          ...field.options,
          hidden: target.value,
        },
      }
      dispatchUpdate()
    }}
    value={field.options.hidden || '__show'}
    slot="hide"
  >
    <option value="__show">Always</option>
    {#each options as item}
      <optgroup label={item.label}>
        {#each item.options as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </optgroup>
    {/each}
  </select>
  <!-- <input type="checkbox" bind:checked={field.is_static} slot="static" /> -->

  {#each field.fields as subfield, i (subfield.id)}
    <svelte:self
      field={cloneDeep(subfield)}
      isFirst={i === 0}
      isLast={i === field.fields.length - 1}
      options={visibilityOptions}
      top_level={false}
      on:delete
      on:move
      on:createsubfield
      on:input={({ detail: updatedSubfield }) => {
        field.fields = field.fields.map((subfield) =>
          subfield.id === updatedSubfield.id ? updatedSubfield : subfield
        )
        dispatchUpdate()
      }}
      level={level + 1}
    />
  {/each}
</EditField>
{#if field.type === 'select'}
  <SelectField {field} {level} on:input={dispatchUpdate} />
{/if}
{#if field.type === 'repeater' || field.type === 'group'}
  <button
    class="field-button subfield-button"
    data-level={level}
    on:click={() => dispatch('createsubfield', field)}
    style:transform="translateX({1.5 + level}rem)"
    style:width="calc(100% - {1.5 + level}rem)"
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
