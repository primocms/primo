<script>
  import { find as _find, chain as _chain, cloneDeep as _cloneDeep } from 'lodash-es'
  import pluralize from '../libraries/pluralize';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  import { getPlaceholderValue } from '../utils';
  import { createUniqueID } from '../utilities';
  import { Card } from '../components/misc';
  import fieldTypes from './index.js';

  export let field;

  function addRepeaterItem() {
    repeaterFieldValues = [...repeaterFieldValues, createSubfield()];
    onInput();
  }

  function removeRepeaterItem(itemIndex) {
    repeaterFieldValues = repeaterFieldValues.filter((_, i) => i !== itemIndex);
    onInput();
  }

  function moveRepeaterItem(indexOfItem, direction) {
    const item = repeaterFieldValues[indexOfItem];
    const withoutItem = repeaterFieldValues.filter((_, i) => i !== indexOfItem);
    if (direction === 'up') {
      repeaterFieldValues = [
        ...withoutItem.slice(0, indexOfItem - 1),
        item,
        ...withoutItem.slice(indexOfItem - 1),
      ];
    } else if (direction === 'down') {
      repeaterFieldValues = [
        ...withoutItem.slice(0, indexOfItem + 1),
        item,
        ...withoutItem.slice(indexOfItem + 1),
      ];
    } else {
      console.error('Direction must be up or down');
    }
  }

  function createSubfield() {
    return field.fields.map((subfield) => ({
      ...subfield,
      id: createUniqueID(),
      value: getPlaceholderValue(subfield),
    }));
  }

  let repeaterFieldValues = Array.isArray(field.value)
    ? field.value.map((value) => field.fields.map((subfield) => ({
        ...subfield,
        fields: _cloneDeep(subfield.fields.map(sub => ({
          ...sub,
          value: value[subfield.key]?.[sub.key]
        }))),
        value: value[subfield.key]
      })))
    : [];

  function onInput() {
    field.value = repeaterFieldValues.map((items, i) => _chain(items).keyBy("key").mapValues('value').value());
    dispatch('input');
  }

  $: repeaterFieldValues = repeaterFieldValues.map(f => {
    f._key = createUniqueID()
    return f
  })

  function getFieldComponent(subfield) {
    const field = _find(fieldTypes, ['id', subfield.type])
    return field ? field.component : null
  }

</script>

<Card id="repeater-{field.key}">
  <header>{field.label}</header>
  <div class="fields">
    {#each repeaterFieldValues as fieldValue, i (fieldValue._key)}
      <div
        class="repeater-item"
        id="repeater-{field.key}-{i}">
        <div class="item-options">
          {#if i !== 0}
            <button
              title="Move {field.label} up"
              on:click={() => moveRepeaterItem(i, 'up')}>
              <i class="fas fa-arrow-up" />
            </button>
          {/if}
          {#if i !== repeaterFieldValues.length - 1}
            <button
              title="Move {field.label} down"
              on:click={() => moveRepeaterItem(i, 'down')}>
              <i class="fas fa-arrow-down" />
            </button>
          {/if}
          <button
            title="Delete {field.label} item"
            on:click={() => removeRepeaterItem(i)}>
            <i class="fas fa-trash" />
          </button>
        </div>
        {#each fieldValue as subfield (fieldValue._key + subfield.key)}
          <div
            class="repeater-item-field"
            id="repeater-{field.key}-{i}-{subfield.key}">
            {#if subfield.type === 'repeater'}
              <svelte:self field={subfield} on:input={onInput} />
            {:else}
              <svelte:component
                this={getFieldComponent(subfield)}
                field={subfield}
                on:input={onInput} />
            {/if}
          </div>
        {/each}
      </div>
    {/each}
    <button class="field-button" on:click={() => addRepeaterItem()}>
      <i class="fas fa-plus mr-1" />
      <span>Add {pluralize.singular(field.label)}</span>
    </button>
  </div>
</Card>

<style lang="postcss">
  header {
    width: 100%;
    padding: 0.25rem 0;
    font-weight: 700;
    font-size: var(--font-size-2);
  }

  .fields {
    display: grid;
    /* grid-template-columns: 1fr 1fr; */
    gap: 1rem;
    grid-row-gap: 2rem;
  }
  .repeater-item {
    flex: 1;
    padding: 1rem;
    background: var(--color-gray-9);
    display: flex;
    flex-direction: column;
    position: relative;
    border: 1px solid var(--color-gray-8);
    border-radius: 1px;
    min-width: 10rem;
    padding-top: 2.5rem;

    &:last-of-type {
      margin-bottom: 0;
    }

    .item-options {
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      padding: 0.25rem 0.5rem;
      color: var(--color-gray-2);
      z-index: 10;
      border-radius: 1px;
      border-bottom: 1px solid var(--color-gray-8);
      gap: 9px;
      display: flex;
      justify-content: flex-end;

      button {
        &:focus {
          outline: 0;
        }
        &:hover {
          color: var(--primo-color-primored);
        }
        &:last-child {
          margin-left: 0.5rem;
          color: var(--color-gray-5);

          &:hover {
            color: var(--primo-color-primored);
          }
        }
      }
    }
  }
  .repeater-item-field {
    margin-bottom: 0.5rem;
  }
  .repeater-item-field:not(:first-child) {
    padding-top: 0;
  }
  .field-button {
    width: 100%;
    background: var(--color-gray-8);
    border: 1px solid var(--primo-color-primored);
    color: var(--color-gray-3);
    padding: 0.5rem 0;
    border-radius: 1px;
    transition: background 0.1s, color 0.1s;

    &:hover {
      background: var(--primo-color-primored);
    }

    /* &[disabled] {
      background: var(--color-gray-5);
      cursor: not-allowed;
    } */

    i {
      margin-right: 0.5rem;
    }
  }

</style>
