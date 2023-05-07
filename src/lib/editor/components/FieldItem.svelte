<script>
  import { cloneDeep, chain as _chain, isEqual } from 'lodash-es'
  import { getContext } from 'svelte'
  import autosize from 'autosize'
  import Toggle from 'svelte-toggle'
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  import EditField from '$lib/editor/components/inputs/EditField.svelte'
  import fieldTypes from '$lib/editor/stores/app/fieldTypes'
  import SelectField from '$lib/editor/field-types/SelectField.svelte'
  import { getPlaceholderValue } from '$lib/editor/utils'

  export let level = 0
  export let field
  export let isFirst
  export let isLast
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

  // Auto-fill key when setting label
  let key_edited = false

  // autosize info textarea
  let info_textarea
  $: if (info_textarea) {
    autosize(info_textarea)
  }
</script>

<EditField
  {level}
  {isFirst}
  {isLast}
  {top_level}
  has_subfields={field.type === 'group' || field.type === 'repeater'}
  minimal={field.type === 'info'}
  showDefaultValue={['content', 'number', 'url', 'select', 'text'].includes(
    field.type
  )}
  showVisibilityOptions={field.type !== 'select' && options.length > 0
    ? options
    : false}
  on:duplicate={() => dispatch('duplicate', field)}
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
    bind:this={info_textarea}
    slot="main"
    class="info"
    value={field.options.info || ''}
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
    on:input={({ target }) => {
      if (!key_edited) {
        field.key = validateFieldKey(target.value)
      }
      dispatchUpdate()
    }}
    slot="label"
  />
  <input
    class="input key-input"
    type="text"
    placeholder="heading"
    value={field.key}
    on:input={({ target }) => {
      key_edited = true
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
  <div slot="toggle">
    {#if getContext('show_static_field')}
      <Toggle
        label="Static"
        toggled={field.is_static}
        on:toggle={({ detail }) => {
          field.is_static = detail
        }}
      />
    {/if}
  </div>

  <!-- <input type="checkbox" bind:checked={field.is_static} slot="static" /> -->

  {#each field.fields as subfield, i (subfield.id)}
    <svelte:self
      field={cloneDeep(subfield)}
      isFirst={i === 0}
      isLast={i === field.fields.length - 1}
      options={visibilityOptions}
      top_level={false}
      level={level + 1}
      on:delete
      on:move
      on:createsubfield
      on:input={({ detail: updatedSubfield }) => {
        field.fields = field.fields.map((subfield) =>
          subfield.id === updatedSubfield.id ? updatedSubfield : subfield
        )
        dispatchUpdate()
      }}
    />
  {/each}
  {#if field.type === 'repeater' || field.type === 'group'}
    <button
      class="subfield-button"
      data-level={level}
      on:click={() => dispatch('createsubfield', field)}
    >
      Create Subfield
    </button>
  {/if}
</EditField>
{#if field.type === 'select'}
  <SelectField {field} {level} on:input={dispatchUpdate} />
{/if}

<style lang="postcss">
  select[slot='hide'] {
    background: transprarent;
    border: 1px solid #333333;
    padding: 0.25rem;
  }
  select[slot='type'] {
    height: 100%;
    width: 100%;
    border: 1px solid #333333;
    border-radius: 0.25rem;
    background: #1f1f1f;
    color: #b6b6b6;
    font-size: var(--font-size-2);
    font-weight: 400;
    padding: 0.5rem;
  }
  .info {
    border: 1px solid #333333;
    background: transparent;
    color: var(--color-gray-2);
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    width: 100%;
    font-size: 0.875rem;
  }
  .subfield-button {
    width: 100%;
    border-radius: 0.25rem;
    margin-top: 10px;
    padding: 0.45rem 1rem;
    font-size: var(--font-size-2);
    background-color: #292929;
    color: var(--color-gray-2);
    transition: var(--transition-colors);
    outline: 0;
    display: block;

    &:hover {
      background: #333333;
    }
    /* &:focus {
      background: var(--color-gray-8);
    } */
  }

  .input {
    border: 1px solid #333333;
    background: #1f1f1f;
    padding: 0.5rem 0.75rem;
    border-radius: 0.25rem;
    height: 100%;
    font-size: var(--font-size-2);

    &::placeholder {
      color: var(--color-gray-7);
    }
    &:focus {
      outline: 0;
    }
  }
</style>
