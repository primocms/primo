<script>
  import { find, cloneDeep, isEqual, chain as _chain } from 'lodash-es';
  import { EditField } from '../../components/inputs';
  import { Tabs } from '../../components/misc';
  import { Card } from '../../components/misc';
  import { createUniqueID } from '../../utilities';
  import {getEmptyValue} from '../../utils'

  import ModalHeader from './ModalHeader.svelte';
  import fieldTypes from '../../stores/app/fieldTypes';
  import { showingIDE, userRole } from '../../stores/app';
  import { locale } from '../../stores/app/misc';
  import { saveFields } from '../../stores/actions';
  import modal from '../../stores/app/modal';
  import { id as pageID, fields as pageFields } from '../../stores/app/activePage';
  import { fields as siteFields, content } from '../../stores/data/draft';
  import RepeaterField from '../../components/FieldTypes/RepeaterField.svelte';
  import GroupField from '../../components/FieldTypes/GroupField.svelte';

  let localContent = cloneDeep($content)

  let localPageFields = cloneDeep($pageFields).map(field => ({
    ...field,
    value: localContent[$locale][$pageID][field.key]
  }));
  let localSiteFields = cloneDeep($siteFields).map(field => ({
    ...field,
    value: localContent[$locale][field.key]
  }));


  const allFieldTypes = [
    // {
    //   id: 'custom',
    //   label: 'Custom',
    //   component: CustomFieldType,
    //   devComponent: CustomFieldDevType,
    // },
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

  const Field = () => ({
    id: createUniqueID(),
    key: '',
    label: '',
    value: '',
    type: 'text',
    fields: [],
  });

  function addField() {
    if (showingPage) {
      localPageFields = [...localPageFields, Field()];
    } else {
      localSiteFields = [...localSiteFields, Field()];
    }
  }

  function addSubField(id) {
    if (showingPage) {
      localPageFields = localPageFields.map((field) => ({
        ...field,
        fields: field.id === id ? [...field.fields, Field()] : field.fields,
      }));
    } else {
      localSiteFields = localSiteFields.map((field) => ({
        ...field,
        fields: field.id === id ? [...field.fields, Field()] : field.fields,
      }));
    }
  }

  function deleteSubfield(fieldId, subfieldId) {
    if (showingPage) {
      localPageFields = localPageFields.map((field) =>
        field.id !== fieldId
          ? field
          : {
              ...field,
              fields: field.fields.filter(
                (subfield) => subfield.id !== subfieldId
              ),
            }
      );
    } else {
      localSiteFields = localSiteFields.map((field) =>
        field.id !== fieldId
          ? field
          : {
              ...field,
              fields: field.fields.filter(
                (subfield) => subfield.id !== subfieldId
              ),
            }
      );
    }
  }

  function deleteField(id) {
    if (showingPage) {
      localPageFields = localPageFields.filter((field) => field.id !== id);
    } else {
      localSiteFields = localSiteFields.filter((field) => field.id !== id);
    }
  }

  $: $locale, setupFields()
  function setupFields() {
    localPageFields = getFieldValues(localPageFields)
    localSiteFields = getFieldValues(localSiteFields)
  }

  function getFieldValues(fields) {
    return fields.map(field => ({
      ...field,
      value: (localContent[$locale][field.key] || getEmptyValue(field))
    }))
  }

  function saveLocalContent() {
    // TODO: use _set to mutate the object instead of reassigning it on every keypress
    localContent = {
      ...localContent,
      [$locale]: {
        ...localContent[$locale],
        ..._chain(localSiteFields).keyBy('key').mapValues('value').value(),
        [$pageID]: {
          ...localContent[$locale][$pageID],
          ..._chain(localPageFields).keyBy('key').mapValues('value').value()
        }
      }
    }
    console.log(localContent)
  }

  let disabled = false;

  const tabs = [
    {
      label: 'Page',
      icon: 'square',
    },
    {
      label: 'Site',
      icon: 'th',
    },
  ];
  let activeTab = tabs[0];

  let showingPage = true;
  $: showingPage = activeTab === tabs[0];

  function getComponent(field) {
    const fieldType = find(allFieldTypes, ['id', field.type]);
    if (fieldType) {
      return fieldType.component;
    } else {
      console.warn(
        `Field type '${field.type}' no longer exists, removing '${field.label}' field`
      );
      return null;
    }
  }

  function getDevComponent(field) {
    const fieldType = find(allFieldTypes, ['id', field.type]);
    if (fieldType) {
      return fieldType.devComponent;
    } else {
      console.warn(
        `Field type '${field.type}' no longer exists, removing '${field.label}' field`
      );
      return null;
    }
  }

  function validateFieldKey(key) {
    // replace dash and space with underscore
    return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase();
  }

  function moveField({ i: parentIndex, direction, childIndex = null }) {
    const activeFields = showingPage ? localPageFields : localSiteFields;
    const parentField = activeFields[parentIndex];
    let updatedFields = activeFields;

    if (direction !== 'up' && direction !== 'down') {
      console.error('Direction must be up or down');
      return;
    }

    if (childIndex === null) {
      const withoutItem = activeFields.filter((_, i) => i !== parentIndex);
      updatedFields = {
        up: [
          ...withoutItem.slice(0, parentIndex - 1),
          parentField,
          ...withoutItem.slice(parentIndex - 1),
        ],
        down: [
          ...withoutItem.slice(0, parentIndex + 1),
          parentField,
          ...withoutItem.slice(parentIndex + 1),
        ],
      }[direction];
    } else {
      const childField = parentField.fields[childIndex];
      const withoutItem = parentField.fields.filter((_, i) => i !== childIndex);
      updatedFields[parentIndex].fields = {
        up: [
          ...withoutItem.slice(0, childIndex - 1),
          childField,
          ...withoutItem.slice(childIndex - 1),
        ],
        down: [
          ...withoutItem.slice(0, childIndex + 1),
          childField,
          ...withoutItem.slice(childIndex + 1),
        ],
      }[direction];
    }

    if (showingPage) {
      localPageFields = updatedFields;
    } else {
      localSiteFields = updatedFields;
    }
  }
  
  function applyFields() {
    saveFields(localPageFields, localSiteFields, localContent)
    modal.hide();
  }

  let onChange = () => {};

</script>

<ModalHeader
  icon="fas fa-database"
  title={$showingIDE ? 'Fields' : 'Content'}
  button={{ label: `Draft`, icon: 'fas fa-check', onclick: applyFields }}
  warn={() => {
    if (!isEqual(localPageFields, $pageFields) || !isEqual(localSiteFields, $siteFields)) {
      const proceed = window.confirm('Undrafted changes will be lost. Continue?');
      return proceed;
    } else return true;
  }} />

<main>
  <Tabs {tabs} bind:activeTab />
  {#if $showingIDE}
    {#if showingPage}
      {#each localPageFields as field, i}
        <Card>
          <EditField
            minimal={field.type === 'info'}
            on:delete={() => deleteField(field.id)}
            on:move={({ detail: direction }) => {
              console.log(direction);
              moveField({ i, direction });
            }}
            {disabled}>
            <select bind:value={field.type} slot="type" {disabled}>
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
              slot="label"
              {disabled} />
            <input
              class="input key-input"
              type="text"
              placeholder="main_heading"
              bind:value={field.key}
              on:input={() => (field.key = validateFieldKey(field.key))}
              slot="key"
              {disabled} />
          </EditField>
          <!-- <svelte:component this={field.devComponent} /> -->
          <svelte:component this={getDevComponent(field)} {field} />
          {#if field.type === 'group'}
            {#if field.fields}
              {#each field.fields as subfield, childIndex}
                <EditField
                  fieldTypes={$fieldTypes}
                  on:move={({ detail: direction }) => moveField( { i, direction, childIndex } )}
                  on:delete={() => deleteSubfield(field.id, subfield.id)}
                  {disabled}>
                  <select bind:value={subfield.type} slot="type" {disabled}>
                    {#each $fieldTypes as field}
                      <option value={field.id}>{field.label}</option>
                    {/each}
                  </select>
                  <input
                    class="input"
                    type="text"
                    placeholder="Heading"
                    bind:value={subfield.label}
                    slot="label"
                    {disabled} />
                  <input
                    class="input"
                    type="text"
                    placeholder="main_heading"
                    bind:value={subfield.key}
                    slot="key"
                    {disabled} />
                </EditField>
              {/each}
            {/if}
            <button
              class="field-button subfield-button"
              on:click={() => addSubField(field.id)}
              {disabled}><i class="fas fa-plus" />Add a Subfield</button>
          {:else if field.type === 'repeater'}
            {#if field.fields}
              {#each field.fields as subfield, childIndex}
                <EditField
                  fieldTypes={$fieldTypes}
                  child={true}
                  on:move={({ detail: direction }) => moveField( { i, direction, childIndex } )}
                  on:delete={() => deleteSubfield(field.id, subfield.id)}
                  {disabled}>
                  <select bind:value={subfield.type} slot="type" {disabled}>
                    {#each $fieldTypes as field}
                      <option value={field.id}>{field.label}</option>
                    {/each}
                  </select>
                  <input
                    class="input"
                    type="text"
                    placeholder="Heading"
                    bind:value={subfield.label}
                    slot="label"
                    {disabled} />
                  <input
                    class="input"
                    type="text"
                    placeholder="main_heading"
                    bind:value={subfield.key}
                    slot="key"
                    {disabled} />
                </EditField>
              {/each}
            {/if}
            <button
              class="field-button subfield-button"
              on:click={() => addSubField(field.id)}
              {disabled}><i class="fas fa-plus" />Add a Subfield</button>
          {/if}
        </Card>
      {/each}
    {:else}
      {#each localSiteFields as field (field.id)}
        <Card>
          <EditField
            minimal={field.type === 'info'}
            on:delete={() => deleteField(field.id)}
            {disabled}>
            <select bind:value={field.type} slot="type" {disabled}>
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
              slot="label"
              {disabled} />
            <input
              class="input key-input"
              type="text"
              placeholder="main_heading"
              bind:value={field.key}
              on:input={() => (field.key = validateFieldKey(field.key))}
              slot="key"
              {disabled} />
          </EditField>
          <svelte:component this={getDevComponent(field)} {field} />
          {#if field.type === 'group'}
            {#if field.fields}
              {#each field.fields as subfield}
                <EditField
                  child={true}
                  fieldTypes={$fieldTypes}
                  on:delete={() => deleteSubfield(field.id, subfield.id)}
                  {disabled}>
                  <select bind:value={subfield.type} slot="type" {disabled}>
                    {#each $fieldTypes as field}
                      <option value={field.id}>{field.label}</option>
                    {/each}
                  </select>
                  <input
                    class="input"
                    type="text"
                    placeholder="Heading"
                    bind:value={subfield.label}
                    slot="label"
                    {disabled} />
                  <input
                    class="input"
                    type="text"
                    placeholder="main_heading"
                    bind:value={subfield.key}
                    slot="key"
                    {disabled} />
                </EditField>
              {/each}
            {/if}
            <button
              class="field-button subfield-button"
              on:click={() => addSubField(field.id)}
              {disabled}><i class="fas fa-plus" />Add a Subfield</button>
          {:else if field.type === 'repeater'}
            {#if field.fields}
              {#each field.fields as subfield}
                <EditField
                  fieldTypes={$fieldTypes}
                  on:delete={() => deleteSubfield(field.id, subfield.id)}
                  {disabled}>
                  <select bind:value={subfield.type} slot="type" {disabled}>
                    {#each $fieldTypes as field}
                      <option value={field.id}>{field.label}</option>
                    {/each}
                  </select>
                  <input
                    class="input"
                    type="text"
                    placeholder="Heading"
                    bind:value={subfield.label}
                    slot="label"
                    {disabled} />
                  <input
                    class="input"
                    type="text"
                    placeholder="main_heading"
                    bind:value={subfield.key}
                    slot="key"
                    {disabled} />
                </EditField>
              {/each}
            {/if}
            <button
              class="field-button subfield-button"
              on:click={() => addSubField(field.id)}
              {disabled}><i class="fas fa-plus" />Add a Subfield</button>
          {/if}
        </Card>
      {/each}
    {/if}
    <button class="field-button" on:click={addField} {disabled}><i
        class="fas fa-plus" />Add a Field</button>
  {:else if showingPage}
    {#each localPageFields as field}
      {#if getComponent(field)}
        <div class="field-item" id="field-{field.key}">
          <svelte:component
            this={getComponent(field)}
            {field}
            fields={localPageFields.filter((f) => f.id !== field.id)}
            on:input={saveLocalContent} />
        </div>
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
  {:else}
    {#each localSiteFields as field}
      {#if getComponent(field)}
        <div class="field-item" id="field-{field.key}">
          <svelte:component
            this={getComponent(field)}
            {field}
            fields={localSiteFields.filter((f) => f.id !== field.id)}
            on:input={saveLocalContent} />
        </div>
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
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    color: var(--color-gray-2);
    background: var(--primo-color-black);
    overflow: scroll;

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

    select {
      background-image: url("data:image/svg+xml;utf8,<svg fill='white' height='24' viewBox='0 0 24 24' width='24' xmlns='http://www.w3.org/2000/svg'><path d='M7 10l5 5 5-5z'/><path d='M0 0h24v24H0z' fill='none'/></svg>");
      background-position: 100%;
      background-repeat: no-repeat;
      appearance: none;
      width: 100%;
      padding: 8px;
      border-right: 4px solid transparent;
      background: var(--color-gray-9);
      color: var(--color-gray-2);
      font-size: var(--font-size-2);
      font-weight: 600;
      border: 0;
    }
  }
  textarea.info {
    width: 100%;
    background: transparent;
    height: 7rem;
    padding: 1rem;
  }
  .field-item {
    padding: 1rem;
    box-shadow: var(--box-shadow);
    margin-bottom: 0.5rem;
    background: var(--color-gray-9);
  }
  .input {
    padding: 0.25rem 0.5rem;
  }
  input,
  select {
    outline: 0;
    border: 0;
  }
  .field-button {
    width: 100%;
    background: var(--color-gray-8);
    color: var(--color-gray-3);
    padding: 0.5rem 0;
    border-radius: var(--primo-border-radius);
    transition: var(--transition-colors);

    i {
      margin-right: 0.5rem;
    }
  }
  .field-button:hover {
    background: var(--color-gray-9);
  }
  .field-button[disabled] {
    background: var(--color-gray-5);
    cursor: not-allowed;
  }
  .field-button.subfield-button {
    width: calc(100% - 1rem);
    border-radius: 2px;
    font-size: var(--font-size-2);
    padding: 4px 0;
    margin: 8px 0;
    margin-left: 1.5rem;
    color: var(--color-gray-2);
    transition: var(--transition-colors);
    display: block;
  }
  input {
    background: var(--color-gray-7);
    color: var(--color-gray-2);
    border-radius: 2px;
  }
  input:focus {
    outline: 0;
  }
  select {
    padding: 0.5rem;
    border-right: 4px solid transparent;
    background: var(--color-gray-9);
    color: var(--color-gray-2);
    font-size: var(--font-size-2);
    font-weight: 600;
  }

  button {
    i {
      margin-right: 0.5rem;
    }
  }

</style>
