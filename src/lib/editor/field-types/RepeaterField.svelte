<script>
  import {
    find as _find,
    chain as _chain,
    cloneDeep as _cloneDeep,
  } from 'lodash-es'
  import pluralize from '../libraries/pluralize'
  import Icon from '@iconify/svelte'
  import { createEventDispatcher, onDestroy, tick } from 'svelte'

  // idb crashes chrome (try primo, server)
  import * as idb from 'idb-keyval'
  const dispatch = createEventDispatcher()

  import { locale } from '../stores/app/misc'
  import { getPlaceholderValue } from '../utils'
  import { createUniqueID } from '../utilities'
  import { fieldTypes } from '../stores/app'

  export let field
  export let level = 0

  // ensure value is an array
  if (!Array.isArray(field.value)) {
    field.value = []
  }

  function add_repeater_item() {
    const subfield = createSubfield()
    visibleRepeaters[`${field.key}-${repeaterFieldValues.length}`] = true
    repeaterFieldValues = [...repeaterFieldValues, subfield]
    onInput()
  }

  function removeRepeaterItem(itemIndex) {
    repeaterFieldValues = repeaterFieldValues.filter((_, i) => i !== itemIndex)
    onInput()
  }

  function moveRepeaterItem(indexOfItem, direction) {
    const item = repeaterFieldValues[indexOfItem]
    const withoutItem = repeaterFieldValues.filter((_, i) => i !== indexOfItem)
    if (direction === 'up') {
      repeaterFieldValues = [
        ...withoutItem.slice(0, indexOfItem - 1),
        item,
        ...withoutItem.slice(indexOfItem - 1),
      ]
    } else if (direction === 'down') {
      repeaterFieldValues = [
        ...withoutItem.slice(0, indexOfItem + 1),
        item,
        ...withoutItem.slice(indexOfItem + 1),
      ]
    } else {
      console.error('Direction must be up or down')
    }
    onInput()
  }

  function createSubfield() {
    return field.fields.map((subfield) => ({
      ...subfield,
      id: createUniqueID(),
      value: getPlaceholderValue(subfield),
    }))
  }

  let repeaterFieldValues = []
  getRepeaterFieldValues().then((val) => (repeaterFieldValues = val))

  $: $locale,
    getRepeaterFieldValues().then((val) => (repeaterFieldValues = val))
  $: setTemplateKeys(repeaterFieldValues)

  async function getRepeaterFieldValues() {
    await tick() // need to wait for $locale to change parent content
    return field.value.map((value) =>
      field.fields.map((subfield) => ({
        ...subfield,
        fields: _cloneDeep(
          subfield.fields.map((sub) => ({
            ...sub,
            value: value[subfield.key]?.[sub.key],
          }))
        ),
        value: value[subfield.key],
      }))
    )
  }

  function setTemplateKeys(val) {
    repeaterFieldValues = val.map((f) => {
      f._key = f._key || createUniqueID()
      return f
    })
  }

  function onInput() {
    field.value = repeaterFieldValues.map((items, i) =>
      _chain(items).keyBy('key').mapValues('value').value()
    )
    dispatch('input', field)
  }

  function getFieldComponent(subfield) {
    const field = _find($fieldTypes, ['id', subfield.type])
    return field ? field.component : null
  }

  $: singularLabel = pluralize.singular(field.label)

  function getImage(repeaterItem) {
    const [firstField] = repeaterItem
    if (firstField && firstField.type === 'image') {
      return firstField.value.url
    } else return null
  }

  function getTitle(repeaterItem) {
    const firstField = repeaterItem.find((subfield) =>
      ['text', 'link', 'number'].includes(subfield.type)
    )
    if (firstField) {
      let { value } = repeaterItem[0]
      if (firstField.type === 'link') return value?.label
      else if (firstField.type === 'markdown') return value?.markdown
      else return value
    } else {
      return singularLabel
    }
  }

  let visibleRepeaters = {}
  idb.get(field.id).then((res) => {
    if (res) {
      visibleRepeaters = res
    }
  })

  onDestroy(() => {
    // save visible repeaters
    idb.set(field.id, _cloneDeep(visibleRepeaters))
  })
</script>

<div class="repeater-level-{level}">
  <div class="fields">
    {#each repeaterFieldValues as repeaterItem, i (repeaterItem._key)}
      {@const subfieldID = `${field.key}-${i}`}
      {@const itemImage = getImage(repeaterItem, field)}
      {@const itemTitle = getTitle(repeaterItem, field)}
      <div class="repeater-item" id="repeater-{field.key}-{i}">
        <div class="item-options">
          <button
            class="title"
            on:click={() =>
              (visibleRepeaters[subfieldID] = !visibleRepeaters[subfieldID])}
          >
            {#if itemImage}
              <img
                src={itemImage}
                alt={itemTitle || `Preview for item ${i} in ${field.label}`}
              />
            {:else}
              <span>{itemTitle}</span>
            {/if}
            <Icon
              icon={visibleRepeaters[subfieldID]
                ? 'ph:caret-up-bold'
                : 'ph:caret-down-bold'}
            />
          </button>
          <div class="primo-buttons">
            {#if i !== 0}
              <button
                title="Move {singularLabel} up"
                on:click={() => moveRepeaterItem(i, 'up')}
              >
                <Icon icon="mdi:arrow-up" />
              </button>
            {/if}
            {#if i !== repeaterFieldValues.length - 1}
              <button
                title="Move {singularLabel} down"
                on:click={() => moveRepeaterItem(i, 'down')}
              >
                <Icon icon="mdi:arrow-down" />
              </button>
            {/if}
            <button
              title="Delete {singularLabel} item"
              on:click={() => removeRepeaterItem(i)}
            >
              <Icon icon="ion:trash" />
            </button>
          </div>
        </div>
        {#if visibleRepeaters[subfieldID]}
          <div class="field-values">
            {#each repeaterItem as subfield (repeaterItem._key + subfield.key)}
              <div
                class="repeater-item-field"
                id="repeater-{field.key}-{i}-{subfield.key}"
              >
                {#if subfield.type === 'repeater'}
                  <span class="repeater-label">{subfield.label}</span>
                  <svelte:self
                    field={subfield}
                    on:input={onInput}
                    level={level + 1}
                    visible={true}
                  />
                {:else}
                  <svelte:component
                    this={getFieldComponent(subfield)}
                    field={subfield}
                    level={level + 1}
                    on:input={onInput}
                  />
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
    <button class="field-button" on:click={add_repeater_item}>
      <Icon icon="akar-icons:plus" />
      <span>Add {pluralize.singular(field.label)}</span>
    </button>
  </div>
</div>

<style lang="postcss">
  .fields {
    display: grid;
    gap: 1.5rem;
  }

  .repeater-level-0 {
    --field-border-color: #252627;
  }

  .repeater-level-1 {
    --field-border-color: #3e4041;
  }

  .repeater-level-2 {
    --field-border-color: #58595b;
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
      display: flex;
      gap: 1rem;
      justify-content: space-between;
      align-items: center;
      color: var(--color-gray-2);

      .primo-buttons {
        white-space: nowrap;
      }

      &:not(:only-child) {
        border-bottom: var(--input-border);
        padding-bottom: 0.75rem;
      }

      button.title {
        padding: 0.5rem 0;
        display: flex;
        gap: 1rem;
        align-items: center;
        text-align: left;

        img {
          width: 3rem;
          border-radius: 2px;
        }
      }

      .primo-buttons button {
        &:focus {
          /* outline: 0; */
        }
        &:hover {
          color: var(--primo-color-brand);
        }
        &:last-child {
          margin-left: 0.5rem;
          color: var(--color-gray-5);

          &:hover {
            color: var(--primo-color-brand);
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
  button.field-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    background: var(--primo-button-background);
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
  }
</style>
