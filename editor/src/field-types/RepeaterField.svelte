<script>
  import { find as _find, chain as _chain, cloneDeep as _cloneDeep } from 'lodash-es'
  import pluralize from '../libraries/pluralize';
  import Icon from '@iconify/svelte'
  import {fade} from 'svelte/transition'
  import { createEventDispatcher, onDestroy } from 'svelte';
  import {slide} from 'svelte/transition'
  import {get, set} from 'idb-keyval';
  const dispatch = createEventDispatcher();

  import { getPlaceholderValue } from '../utils';
  import { createUniqueID } from '../utilities';
  import {fieldTypes} from '../stores/app'

  export let field;
  export let level = 0

  function addRepeaterItem() {
    const subfield = createSubfield()
    visibleRepeaters[`${field.key}-${repeaterFieldValues.length}`] = true
    repeaterFieldValues = [...repeaterFieldValues, subfield];
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
    f._key = f._key || createUniqueID()
    return f
  })

  function getFieldComponent(subfield) {
    const field = _find($fieldTypes, ['id', subfield.type])
    return field ? field.component : null
  }

  $: singularLabel = pluralize.singular(field.label)
  function getTitle(field, i) {
    const first = field.fields.find(field => ['text', 'link', 'number'].includes(field.type))
    const key = first ? first.key : null
    let value = field.value[i][key]
    if (typeof(value) === 'object') {
      value = value.label
    }
    return value || singularLabel
  }

  let visibleRepeaters = {}
  get(field.id).then(res => {
    if (res) {
      visibleRepeaters = res
    }
  })

  onDestroy(() => {
    set(field.id, _cloneDeep(visibleRepeaters))
  })
</script>

<div class="repeater-level-{level}">
  <div class="fields" transition={{ duration: 100 }}>
    {#each repeaterFieldValues as fieldValue, i (fieldValue._key)}
      {@const subfieldID = `${field.key}-${i}`}
      <div
        transition:fade={{ duration: 100 }}
        class="repeater-item"
        id="repeater-{field.key}-{i}">
        <div class="item-options">
          <button class="title" on:click={() => {
            visibleRepeaters[subfieldID] = !visibleRepeaters[subfieldID]
          }}>
          {#key subfieldID}
            <span>{getTitle(field, i)}</span>  
          {/key}
          <Icon icon={visibleRepeaters[subfieldID] ? 'ph:caret-up-bold' : 'ph:caret-down-bold'} />
        </button>
          <div class="buttons">
            {#if i !== 0}
              <button
                title="Move {singularLabel} up"
                on:click={() => moveRepeaterItem(i, 'up')}>
                <i class="fas fa-arrow-up" />
              </button>
            {/if}
            {#if i !== repeaterFieldValues.length - 1}
              <button
                title="Move {singularLabel} down"
                on:click={() => moveRepeaterItem(i, 'down')}>
                <i class="fas fa-arrow-down" />
              </button>
            {/if}
            <button
              title="Delete {singularLabel} item"
              on:click={() => removeRepeaterItem(i)}>
              <i class="fas fa-trash" />
            </button>
          </div>
        </div>
        {#if visibleRepeaters[subfieldID]}
          <div class="field-values" transition:slide={{ duration: 100 }}>
            {#each fieldValue as subfield (fieldValue._key + subfield.key)}
              <div
                class="repeater-item-field"
                id="repeater-{field.key}-{i}-{subfield.key}">
                {#if subfield.type === 'repeater'}
                  <span class="repeater-label">{subfield.label}</span>
                  <svelte:self field={subfield} on:input={onInput} level={level+1} visible={true} />
                {:else}
                  <svelte:component
                    this={getFieldComponent(subfield)}
                    field={subfield}
                    level={level+1}
                    on:input={onInput} />
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
    <button class="field-button" on:click={() => addRepeaterItem()}>
      <i class="fas fa-plus mr-1" />
      <span>Add {pluralize.singular(field.label)}</span>
    </button>
  </div>
</div>

<style lang="postcss">
  header {
    /* padding: 0.25rem 0; */
    font-size: var(--label-font-size);
    font-weight: var(--label-font-weight);

    display: flex;
    justify-content: space-between;
  }

  .header-button {
    width: 100%;

    & + .fields {
      padding-top: 1rem;
    }
  }

  .fields {
    display: grid;
    /* grid-template-columns: 1fr 1fr; */
    gap: 3rem;

    /* hr {
      border-color: #222;
      &:last-of-type { display: none }
    } */
  }

  .repeater-level-0 {
    --field-border-color: #252627;
  }

  .repeater-level-1 {
    --field-border-color: #3E4041;
  }

  .repeater-level-2 {
    --field-border-color: #58595B;
  }

  .repeater-level-3 {
    --field-border-color: #888;
  }

  .repeater-level-4 {
    --field-border-color: #aaa;
  }

  .repeater-level-5 {
    --field-border-color: #ccc;
  }

  .repeater-level-5 {
    --field-border-color: #eee;
  }

  .repeater-item {
    flex: 1;
    padding-left: 1.5rem;
    border-left: 0.5rem solid var(--field-border-color, #252627);
    display: grid;
    gap: 1.5rem;
    position: relative;
    border-radius: 1px;
    min-width: 10rem;

    --label-font-size: 0.875rem;
    --label-font-weight: 400;

    &:last-of-type {
      margin-bottom: 0;
    }

    .item-options {
      transition: 0.1s padding, 0.1s border-color;
      font-size: var(--title-font-size);
      font-weight: var(--title-font-weight);
      border-bottom: 1px solid transparent;
      /* position: absolute;
      top: 0;
      right: 0;
      left: 0; */
      display: flex;
      justify-content: space-between;
      align-items: center;
      /* padding: 1.5rem; */
      /* padding: 0.25rem 0.5rem; */
      color: var(--color-gray-2);
      /* z-index: 10; */
      /* border-bottom: 1px solid var(--color-gray-8); */

      &:not(:only-child) {
        border-bottom: var(--input-border);
        padding-bottom: 0.75rem;
      }

      button.title {
        padding: 1rem 0;
        display: flex;
        gap: 1rem;
        align-items: center;
      }

      .buttons button {

        &:focus {
          /* outline: 0; */
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

    .field-values {
      display: grid;
      gap: 2rem;

      .repeater-label {
        display: block;
        font-size: var(--title-font-size);
        font-weight: var(--title-font-weight);
        margin-bottom: 1rem;
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
    background: var(--button-background);
    color: var(--button-color);
    padding: 0.5rem 0;
    border-radius: 1px;
    transition: background 0.1s, color 0.1s;

    font-size: 0.875rem;
    padding: 0.75rem;
    border-radius: 4px;
    font-weight: 700;

    &:hover {
      background: var(--button-hover-color);
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
