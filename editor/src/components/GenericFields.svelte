<script>
  import {createEventDispatcher} from 'svelte'
  import { find, cloneDeep, isEqual, chain as _chain, set as _set, get as _get } from 'lodash-es';
  import { _ as C } from 'svelte-i18n';
  import { Card } from './misc';

  import { showingIDE, userRole, fieldTypes } from '../stores/app';
  import {Field} from '../const'
  import FieldItem from '../views/modal/ComponentEditor/FieldItem.svelte'

  export let fields

  const dispatch = createEventDispatcher()

  function addField() {
    fields = [...fields, Field()];
  }

  function createSubfield({detail:field}) {
    const idPath = getFieldPath(fields, field.id)
    let updatedFields = cloneDeep(fields)
    handleSubfieldCreation(fields)

    function handleSubfieldCreation(fieldsToModify) {
      if (find(fieldsToModify, ['id', field.id])) { // field is at this level
        const newField = cloneDeep(field)
        newField.fields = [
          ...newField.fields,
          Field()
        ]
        _set(updatedFields, idPath, newField)
      } else { // field is lower
        fieldsToModify.forEach(field => handleSubfieldCreation(field.fields));
      }
    }
    fields = updatedFields
  }

  function deleteField({detail:field}) {
    const idPath = getFieldPath(fields, field.id)
    let updatedFields = cloneDeep(fields)

    let parentField = _get(updatedFields, idPath.slice(0, -2))
    if (parentField) {
      handleDeleteSubfield(fields)
    } else {
      fields = fields.filter((f) => f.id !== field.id)
    }

    function handleDeleteSubfield(fieldsToModify) {
      if (find(fieldsToModify, ['id', parentField.id])) {
        const newField = cloneDeep(parentField)
        newField.fields = newField.fields.filter((f) => f.id != field.id)
        _set(updatedFields, idPath.slice(0, -2), newField)
      }
      else {
        fieldsToModify.forEach(field => handleDeleteSubfield(field.fields));
      }
      fields = updatedFields
    }
  }

  let disabled = false;

  function getComponent(field) {
    const fieldType = find($fieldTypes, ['id', field.type]);
    if (fieldType) {
      return fieldType.component;
    } else {
      console.warn(
        `Field type '${field.type}' no longer exists, removing '${field.label}' field`
      );
      return null;
    }
  }

  function moveField({detail}) {
    const { field, direction } = detail
    const idPath = getFieldPath(fields, field.id)

    let updatedFields = cloneDeep(fields)

    handleFieldMove(fields)

    function handleFieldMove(fieldsToModify) {
      const indexToMove = fieldsToModify.findIndex(f => f.id === field.id)
      if (indexToMove > -1) { // field is at this level
        const withoutItem = fieldsToModify.filter((_, i) => i !== indexToMove);
        const newFields = {
            up: [
              ...withoutItem.slice(0, indexToMove - 1),
              field,
              ...withoutItem.slice(indexToMove - 1),
            ],
            down: [
              ...withoutItem.slice(0, indexToMove + 1),
              field,
              ...withoutItem.slice(indexToMove + 1),
            ],
          }[direction]
        if (idPath.length === 1) { // field is at root level
          updatedFields = newFields
        } else {
          const path = idPath.slice(0, -1) // modify 'fields' containing field being moved
          _set(updatedFields, path, newFields)
        }
      } else { // field is lower
        fieldsToModify.forEach(field => handleFieldMove(field.fields));
      }
    }
    fields = updatedFields
  }

  function getFieldPath(fields, id) {
    for (const [i, field] of fields.entries()) {
      const result = getFieldPath(field.fields, id)
      if (result) {
        result.unshift(i, 'fields');
        return result
      } else if (field.id === id) {
        return [i]
      } 
    }
  }

</script>

<main>
  {#if $showingIDE}
    {#each fields as field, i (field.id)}
      <FieldItem
        {field}
        isFirst={i === 0}
        isLast={i === fields.length - 1}
        on:delete={deleteField}
        on:move={moveField}
        on:createsubfield={createSubfield}
        on:input={({detail}) => {
          field = detail
          dispatch('input')
        }}
      />
    {/each}
    <button class="field-button" on:click={addField} {disabled}><i class="fas fa-plus" />{$C('Add a Field')}</button>
  {:else}
    {#each fields as field}
      {@const isValid = (field.key || field.type === 'info') && getComponent(field)}
      {@const hasChildFields = field.fields.length > 0}
      {#if isValid}
      <Card title={hasChildFields ? field.label : null}>
        <div class="field-item" id="field-{field.key}" class:repeater={field.key === 'repeater'}>
          <svelte:component
            this={getComponent(field)}
            {field}
            fields={fields.filter((f) => f.id !== field.id)}
            on:input />
        </div>
      </Card>
      {:else}
        <p class="empty-description">This field needs a field key in order to be valid</p>
      {/if}
    {:else}
      <p class="empty-description">
        {#if $userRole === 'developer'}
          You'll need to create and integrate a field before you can edit
          content from here
        {:else}
          The site developer will need to create and integrate a field before
          you can edit content from here
        {/if}
      </p>
    {/each}
  {/if}
</main>

<style lang="postcss">
  main {
    display: grid;
    gap: 1rem;
    padding: 0.5rem;
    color: var(--color-gray-2);
    background: var(--primo-color-black);
    min-width: 23rem;
    height: 100%;
    overflow-y: scroll;
    place-content: flex-start;
    justify-content: stretch;

    .empty-description {
      color: var(--color-gray-4);
      font-size: var(--font-size-2);
      text-align: center;
      height: 100%;
      display: flex;
      align-items: flex-start;
      padding: 6rem;
      justify-content: center;
      margin-top: 12px;
    }
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

    i {
      margin-right: 0.5rem;
    }
  }
</style>
