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
  import { id, fields as pageFields } from '../../stores/app/activePage';
  import { fields as siteFields } from '../../stores/data/draft';
  import { pages } from '../../stores/actions';
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
    console.log({ localPageFields, localSiteFields });
    pages.update($id, (page) => ({
      ...page,
      fields: cloneDeep(localPageFields),
    }));
    $siteFields = localSiteFields;
    // updateActivePageWrapper($pageHTML);
    // updateSiteWrapper($siteHTML);
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

<main>
  <Tabs {tabs} bind:activeTab />
  {#if $switchEnabled}
    {#if showingPage}
      {#each localPageFields as field (field.id)}
        <Card>
          <EditField
            minimal={field.type === 'info'}
            on:delete={() => deleteField(field.id)}
            {disabled}>
            <select
              bind:value={field.type}
              slot="type"
              on:change={refreshFields}
              {disabled}>
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
              {#each field.fields as subfield (subfield.id)}
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
    {:else}
      {#each localSiteFields as field (field.id)}
        <Card>
          <EditField
            minimal={field.type === 'info'}
            on:delete={() => deleteField(field.id)}
            {disabled}>
            <select
              bind:value={field.type}
              slot="type"
              on:change={refreshFields}
              {disabled}>
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
              {#each field.fields as subfield (subfield.id)}
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
          <svelte:component this={getComponent(field)} {field} />
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
          <svelte:component this={getComponent(field)} {field} />
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
    background: var(--color-black);

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
    border-radius: var(--border-radius-1);
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
    width: calc(100% - 2rem);
    border-radius: 2px;
    font-size: var(--font-size-2);
    padding: 4px 0;
    margin: 8px 0;
    margin-left: auto;
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
