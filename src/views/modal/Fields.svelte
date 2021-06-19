<script>
  import { find, findIndex, cloneDeep, isEqual } from 'lodash';
  import { EditField } from '../../components/inputs';
  import { Tabs } from '../../components/misc';
  import { Card } from '../../components/misc';
  import { createUniqueID } from '../../utilities';

  import ModalHeader from './ModalHeader.svelte';
  import fieldTypes from '../../stores/app/fieldTypes';
  import { switchEnabled, userRole } from '../../stores/app';
  import modal from '../../stores/app/modal';
  import {
    id,
    fields as pageFields,
    wrapper as pageHTML,
  } from '../../stores/app/activePage';
  import {
    fields as siteFields,
    wrapper as siteHTML,
  } from '../../stores/data/draft';
  import {
    pages,
    updateActivePageWrapper,
    updateSiteWrapper,
  } from '../../stores/actions';
  import RepeaterField from '../../components/FieldTypes/RepeaterField.svelte';
  import GroupField from '../../components/FieldTypes/GroupField.svelte';

  let fields = cloneDeep($pageFields);
  let localPageFields = cloneDeep($pageFields);
  let localSiteFields = cloneDeep($siteFields);

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

  function saveFields(fields) {
    if (showingPage) {
      $pageFields = fields;
    } else {
      $siteFields = fields;
    }
  }

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

  function addRepeaterItem(repeaterField) {
    const keys = repeaterField.fields.map((f) => f.key);
    repeaterField.value = [
      ...repeaterField.value,
      keys.reduce((a, b) => ((a[b] = ''), a), { id: createUniqueID() }), // turn keys into value object
    ];
    refreshFields();
  }

  function removeRepeaterItem(fieldId, itemId) {
    fields = fields.map((field) =>
      field.id !== fieldId
        ? field
        : {
            ...field,
            value: Array.isArray(field.value)
              ? field.value.filter((item) => item.id !== itemId)
              : field.value,
          }
    );
    refreshFields();
  }

  function moveRepeaterItem(field, item, direction) {
    const indexOfItem = findIndex(field.value, ['id', item.id]);
    const withoutItems = field.value.filter((i) => i.id !== item.id);
    if (direction === 'up') {
      field.value = [
        ...withoutItems.slice(0, indexOfItem - 1),
        item,
        ...withoutItems.slice(indexOfItem - 1),
      ];
    } else {
      field.value = [
        ...withoutItems.slice(0, indexOfItem + 1),
        item,
        ...withoutItems.slice(indexOfItem + 1),
      ];
    }
    refreshFields();
  }

  function refreshFields() {
    fields = fields.filter((f) => true);
    saveFields(fields);
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

  function applyFields() {
    // TODO: clean this up, use action
    pages.update($id, (page) => ({
      ...page,
      fields: cloneDeep(localPageFields),
    }));
    $siteFields = localSiteFields;
    updateActivePageWrapper($pageHTML);
    updateSiteWrapper($siteHTML);
    modal.hide();
  }

</script>

<ModalHeader
  icon="fas fa-database"
  title={$switchEnabled ? 'Fields' : 'Content'}
  button={{ label: `Draft`, icon: 'fas fa-check', onclick: applyFields }}
  warn={() => {
    if (!isEqual(localPageFields, $pageFields) || !isEqual(localSiteFields, $siteFields)) {
      const proceed = window.confirm('Undrafted changes will be lost. Continue?');
      return proceed;
    } else return true;
  }}
  variants="mb-4" />

<Tabs {tabs} bind:activeTab />

<div class="flex flex-col p-2 text-gray-200">
  {#if $switchEnabled}
    {#if showingPage}
      {#each localPageFields as field (field.id)}
        <Card variants="field-item bg-gray-900 shadow-sm mb-2">
          <EditField on:delete={() => deleteField(field.id)} {disabled}>
            <select
              bind:value={field.type}
              slot="type"
              on:change={refreshFields}
              {disabled}>
              {#each allFieldTypes as field}
                <option value={field.id}>{field.label}</option>
              {/each}
            </select>
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
              placeholder="main-heading"
              bind:value={field.key}
              slot="key"
              {disabled} />
          </EditField>
          {#if field.type === 'group'}
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
                    placeholder="main-heading"
                    bind:value={subfield.key}
                    slot="key"
                    {disabled} />
                </EditField>
              {/each}
            {/if}
            <button
              class="field-button subfield-button"
              on:click={() => addSubField(field.id)}
              {disabled}><i class="fas fa-plus mr-2" />Create Subfield</button>
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
                    placeholder="main-heading"
                    bind:value={subfield.key}
                    slot="key"
                    {disabled} />
                </EditField>
              {/each}
            {/if}
            <button
              class="field-button subfield-button"
              on:click={() => addSubField(field.id)}
              {disabled}><i class="fas fa-plus mr-2" />Create Subfield</button>
          {/if}
        </Card>
      {/each}
    {:else}
      {#each localSiteFields as field (field.id)}
        <Card variants="field-item bg-gray-900 shadow-sm mb-2">
          <EditField on:delete={() => deleteField(field.id)} {disabled}>
            <select
              bind:value={field.type}
              slot="type"
              on:change={refreshFields}
              {disabled}>
              {#each allFieldTypes as field}
                <option value={field.id}>{field.label}</option>
              {/each}
            </select>
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
              placeholder="main-heading"
              bind:value={field.key}
              slot="key"
              {disabled} />
          </EditField>
          {#if field.type === 'group'}
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
                    placeholder="main-heading"
                    bind:value={subfield.key}
                    slot="key"
                    {disabled} />
                </EditField>
              {/each}
            {/if}
            <button
              class="field-button subfield-button"
              on:click={() => addSubField(field.id)}
              {disabled}><i class="fas fa-plus mr-2" />Create Subfield</button>
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
                    placeholder="main-heading"
                    bind:value={subfield.key}
                    slot="key"
                    {disabled} />
                </EditField>
              {/each}
            {/if}
            <button
              class="field-button subfield-button"
              on:click={() => addSubField(field.id)}
              {disabled}><i class="fas fa-plus mr-2" />Create Subfield</button>
          {/if}
        </Card>
      {/each}
    {/if}
    <button class="field-button" on:click={addField} {disabled}><i
        class="fas fa-plus mr-2" />Add a Field</button>
  {:else if showingPage}
    {#each localPageFields as field}
      {#if getComponent(field)}
        <div class="field-item" id="field-{field.key}">
          <svelte:component this={getComponent(field)} {field} />
        </div>
      {/if}
    {:else}
      <p
        class="text-center h-full flex items-start p-24 justify-center text-lg mt-3">
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
          <svelte:component this={getComponent(field)} {field} />
        </div>
      {/if}
    {:else}
      <p
        class="text-center h-full flex items-start p-24 justify-center text-lg mt-3">
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
</div>

<style>
  .field-item {
    @apply p-4 shadow mb-2 bg-gray-900;
  }
  input,
  select {
    @apply outline-none;
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
  .field-button.subfield-button {
    width: calc(100% - 1rem);
    @apply rounded-sm ml-4 text-sm py-1 mb-2 mt-2 bg-gray-900 text-gray-200 transition-colors duration-100 outline-none;
  }
  .field-button.subfield-button:hover {
    @apply bg-gray-300;
  }
  .field-button.subfield-button:focus {
    @apply bg-gray-200;
  }
  input {
    @apply bg-gray-700 text-gray-200 p-1 rounded-sm;
  }
  input:focus {
    @apply outline-none;
  }
  select {
    @apply p-2 border-r-4 bg-gray-900 text-gray-200 border-transparent text-sm font-semibold;
  }

</style>
