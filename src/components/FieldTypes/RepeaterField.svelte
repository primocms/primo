<script>
  import _ from "lodash";
  import pluralize from "../../libraries/pluralize";
  import { fade } from "svelte/transition";
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  import { createUniqueID } from "../../utilities";
  import { Card } from "../misc";
  import { EditField, GenericField, ImageField } from "../inputs";
  import fieldTypes from "../../stores/app/fieldTypes";

  export let field;

  function addRepeaterItem() {
    const keys = field.fields.map((f) => f.key);
    fieldValues = [...fieldValues, createSubfield()];
    dispatch("input");
  }

  function removeRepeaterItem(itemIndex) {
    fieldValues = fieldValues.filter((_, i) => i !== itemIndex);
    onInput();
  }

  function moveRepeaterItem(indexOfItem, direction) {
    const item = fieldValues[indexOfItem];
    const withoutItem = fieldValues.filter((_, i) => i !== indexOfItem);
    if (direction === "up") {
      fieldValues = [
        ...withoutItem.slice(0, indexOfItem - 1),
        item,
        ...withoutItem.slice(indexOfItem - 1),
      ];
    } else if (direction === "down") {
      fieldValues = [
        ...withoutItem.slice(0, indexOfItem + 1),
        item,
        ...withoutItem.slice(indexOfItem + 1),
      ];
    } else {
      console.error("Direction must be up or down");
    }
  }

  function createSubfield() {
    return field.fields.map((subfield) => ({
      ...subfield,
      id: createUniqueID(),
      value: "",
    }));
  }

  let fieldValues = Array.isArray(field.value)
    ? field.value.map((value) => [
        ...field.fields.map((subfield) => ({
          ...subfield,
          value: value[subfield.key],
        })),
      ])
    : [];

  function onInput() {
    field.value = fieldValues.map((fieldValue) =>
      fieldValue.reduce(
        (obj, item) => Object.assign(obj, { [item.key]: item.value }),
        {}
      )
    );
    dispatch("input");
  }

</script>

<Card variants="pb-4" id="repeater-{field.key}">
  <header class="w-full py-1 font-bold text-sm">{field.label}</header>
  <div class="grid grid-cols-2 gap-2">
    {#each fieldValues as fieldValue, i}
      <div
        class="repeater-item"
        id="repeater-{field.key}-{i}"
        in:fade={{ duration: 100 }}
      >
        <div
          class="absolute top-0 right-0 py-1 px-2 text-gray-200 bg-gray-900 z-10 rounded"
        >
          {#if i !== 0}
            <button
              title="Move {field.label} up"
              on:click={() => moveRepeaterItem(i, 'up')}
            >
              <i class="fas fa-arrow-up" />
            </button>
          {/if}
          {#if i !== fieldValues.length - 1}
            <button
              class="mr-2"
              title="Move {field.label} down"
              on:click={() => moveRepeaterItem(i, 'down')}
            >
              <i class="fas fa-arrow-down" />
            </button>
          {/if}
          <button
            class="text-red-400 hover:text-red-500"
            title="Delete {field.label} item"
            on:click={() => removeRepeaterItem(i)}
          >
            <i class="fas fa-trash" />
          </button>
        </div>
        {#each fieldValue as subfield}
          <div
            class="repeater-item-field"
            id="repeater-{field.key}-{i}-{subfield.key}"
          >
            <svelte:component
              this={_.find($fieldTypes, ['id', subfield.type]).component}
              field={subfield}
              on:input={onInput}
            />
          </div>
        {/each}
      </div>
    {/each}
    <div class="p-2 bg-gray-900">
      <button class="field-button" on:click={() => addRepeaterItem()}>
        <i class="fas fa-plus mr-1" />
        <span>Add {pluralize.singular(field.label)}</span>
      </button>
    </div>
  </div>
</Card>

<style>
  .repeater-item {
    @apply p-4 bg-gray-900 flex flex-col relative border-2 border-primored;
  }
  .repeater-item:last-of-type {
    @apply mb-0;
  }
  .repeater-item-field {
    @apply mb-2;
  }
  .repeater-item-field:not(:first-child) {
    @apply pt-0;
  }
  .field-button {
    @apply w-full bg-gray-800 text-gray-300 py-2 rounded font-medium transition-colors duration-200;
  }
  .field-button:hover {
    @apply bg-gray-900;
  }
  .field-button[disabled] {
    @apply bg-gray-500 cursor-not-allowed;
  }

</style>
