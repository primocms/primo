<script>
  import { cloneDeep, find, isEqual } from 'lodash-es';
  import HSplitPane from './HSplitPane.svelte';
  import { createUniqueID } from '../../../utilities';
  import ModalHeader from '../ModalHeader.svelte';
  import { EditField } from '../../../components/inputs';
  import { PrimaryButton } from '../../../components/buttons';
  import { Tabs, Card } from '../../../components/misc';
  import FullCodeEditor from './FullCodeEditor.svelte';
  import { CodePreview } from '../../../components/misc';
  import RepeaterField from '../../../components/FieldTypes/RepeaterField.svelte';
  import GroupField from '../../../components/FieldTypes/GroupField.svelte';

  import {
    convertFieldsToData,
    createDebouncer,
    processCode,
    processCSS,
    wrapInStyleTags,
  } from '../../../utils';

  import { css as siteCSS, html as siteHTML } from '../../../stores/data/draft';
  import {
    html as pageHTML,
    css as pageCSS,
  } from '../../../stores/app/activePage';
  import { switchEnabled } from '../../../stores/app';
  import fieldTypes from '../../../stores/app/fieldTypes';
  import modal from '../../../stores/app/modal';
  import { createComponent } from '../../../const';
  import { symbols } from '../../../stores/actions';
  import { getAllFields, getSymbol } from '../../../stores/helpers';

  // This is the only way I could figure out how to get lodash's debouncer to work correctly
  const slowDebounce = createDebouncer(1000);
  const quickDebounce = createDebouncer(200);

  export let component = createComponent();
  export let header = {
    label: 'Create Component',
    icon: 'fas fa-code',
    button: {
      icon: 'fas fa-plus',
      label: 'Add to page',
      onclick: (component) => {
        console.warn('Component not going anywhere', component);
      },
    },
  };

  let localComponent = cloneDeep(component);
  function saveRawValue(property, value) {
    localComponent.value[property] = value;
  }

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

  let loading = false;

  let fields = localComponent.value.fields;

  let componentApp;
  let error;
  $: compileComponentCode({
    html: rawHTML,
    css: rawCSS,
    js: rawJS,
    // fields,
  });

  let throttling = false;
  async function compileComponentCode({ html, css, js }) {
    disableSave = true;
    const allFields = getAllFields(fields);
    const data = convertFieldsToData(allFields);
    if (throttling) {
      quickDebounce([compile]);
    } else {
      await compile();
    }
    disableSave = false;

    async function compile() {
      const parentCSS = await processCSS($siteCSS + $pageCSS)
      const timeout = setTimeout(() => {
        throttling = true;
      }, 100);
      const res = await processCode({
        code: {
          html: `${html}
      <svelte:head>
        ${$pageHTML.head}
        ${$siteHTML.head}
        ${wrapInStyleTags(parentCSS)}
      </svelte:head>
      ${$pageHTML.below}
      ${$siteHTML.below}
      `,
          css,
          js,
        },
        data,
        buildStatic: false,
      });
      throttling = false;
      clearTimeout(timeout);
      error = res.error;
      componentApp = res.js;
      saveRawValue('html', html);
      saveRawValue('css', css);
      saveRawValue('js', js);
    }
  }

  let rawHTML = localComponent.value.html;
  let rawCSS = localComponent.value.css;
  let rawJS = localComponent.value.js;

  let isSingleUse = false;
  $: isSingleUse =
    localComponent.type === 'component' && localComponent.symbolID === null;
  function convertToSymbol() {
    const newSymbol = {
      ...localComponent,
      id: createUniqueID(),
      type: 'symbol',
    };
    delete newSymbol.symbolID;
    symbols.create(newSymbol);
    localComponent.symbolID = newSymbol.id;
    saveComponent();
    loadSymbol();
  }

  function separateFromSymbol() {
    localComponent.symbolID = null;
    disabled = false;
  }

  async function loadSymbol() {
    disabled = false;
    const symbol = getSymbol(localComponent.symbolID);
    localComponent = cloneDeep(symbol);
    // compileCSS(symbol.value.css); // workaround for styles breaking
    modal.show('COMPONENT_EDITOR', {
      component: symbol,
      header: {
        title: `Edit ${symbol.title || 'Component'}`,
        icon: 'fas fa-th-large',
        button: {
          icon: 'fas fa-check',
          label: `Draft`,
          onclick: async (symbol) => {
            loading = true;
            symbols.update(symbol);
            modal.hide();
          },
        },
      },
    });
  }

  function addNewField() {
    fields = [...fields, createField()];
    saveRawValue('fields', fields);

    function createField() {
      return {
        id: createUniqueID(),
        key: '',
        label: '',
        value: '',
        type: 'text',
        fields: [],
      };
    }
  }

  function addSubField(id) {
    fields = fields.map((field) => ({
      ...field,
      fields:
        field.id === id
          ? [
              ...field.fields,
              {
                id: createUniqueID(),
                key: '',
                label: '',
                value: '',
                type: 'text',
              },
            ]
          : field.fields,
    }));
    refreshFields();
    saveRawValue('fields', fields);
  }

  // function updateSubfield(parent, self) {
  //   console.log({ parent, self });
  //   fields = fields.map((field) =>
  //     field.id !== parent.id
  //       ? field
  //       : {
  //           ...field,
  //           fields: field.fields.map((subfield) =>
  //             subfield.id === self.id ? self : subfield
  //           ),
  //         }
  //   );
  //   console.log({ localComponent });
  //   refreshFields();
  //   saveRawValue('fields', fields);
  // }

  function deleteSubfield(fieldId, subfieldId) {
    fields = fields.map((field) =>
      field.id !== fieldId
        ? field
        : {
            ...field,
            fields: field.fields.filter(
              (subfield) => subfield.id !== subfieldId
            ),
          }
    );
    refreshFields();
    saveRawValue('fields', fields);
  }

  function deleteField(id) {
    fields = fields.filter((field) => field.id !== id);
    refreshFields();
    saveRawValue('fields', fields);
  }

  function refreshFields() {
    // necessary to re-render field values in preview (since we're mutating `field`)
    fields = fields.filter(Boolean);
    saveRawValue('fields', fields);
    compileComponentCode({
      html: rawHTML,
      css: rawCSS,
      js: rawJS,
    });
  }

  function setPlaceholderValues() {
    fields = fields.map((f) =>
      !f.value
        ? {
            ...f,
            value: getFakeValue(f.type),
          }
        : f
    );
    refreshFields();
  }

  function getFakeValue(type) {
    return (
      {
        text: '',
        content: '',
        image: {
          url: 'https://source.unsplash.com/900x600',
          alt: '',
        },
      }[type] || ''
    );
  }

  const tabs = [
    {
      id: 'code',
      label: 'Code',
      icon: 'code',
    },
    {
      id: 'fields',
      label: 'Fields',
      icon: 'database',
    },
  ];

  let activeTab = tabs[0];

  let disabled = false;
  $: disabled = !!localComponent.symbolID;
  let disableSave = false;

  function getFieldComponent(field) {
    const fieldType = find(allFieldTypes, ['id', field.type]);
    if (fieldType && fieldType.component) {
      return fieldType.component;
    } else {
      return null;
    }
  }

  function moveField({ i: parentIndex, direction, childIndex = null }) {
    const parentField = fields[parentIndex];
    let updatedFields = fields;

    if (direction !== 'up' && direction !== 'down') {
      console.error('Direction must be up or down');
      return;
    }

    if (childIndex === null) {
      const withoutItem = fields.filter((_, i) => i !== parentIndex);
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
    refreshFields();

    fields = updatedFields;
  }

  if (localComponent.symbolID && $switchEnabled) {
    loadSymbol();
  }

  let editorWidth = localStorage.getItem('editorWidth') || '66%';
  let previewWidth = localStorage.getItem('previewWidth') || '33%';

  function validateFieldKey(key) {
    // replace dash and space with underscore
    return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase();
  }

  function saveComponent() {
    if (!disableSave) {
      header.button.onclick(localComponent);
    }
  }

</script>

<ModalHeader
  {...header}
  warn={() => {
    if (!isEqual(localComponent, component)) {
      const proceed = window.confirm('Undrafted changes will be lost. Continue?');
      return proceed;
    } else return true;
  }}
  button={{ ...header.button, onclick: saveComponent, disabled: disableSave }}>
  {#if isSingleUse}
    <button class="convert" on:click={convertToSymbol}>
      <i class="fas fa-clone" />
      <span class="hidden md:inline text-gray-200 font-semibold">Add to Library</span>
    </button>
  {/if}
</ModalHeader>

<main>
  <HSplitPane
    leftPaneSize={editorWidth}
    rightPaneSize={previewWidth}
    on:resize={({ detail }) => {
      const { left, right } = detail;
      localStorage.setItem('editorWidth', left);
      localStorage.setItem('previewWidth', right);
    }}>
    <div slot="left">
      {#if $switchEnabled}
        {#if !disabled}
          <Tabs {tabs} bind:activeTab variants="mb-1" />
        {/if}
        {#if disabled && activeTab === tabs[0]}
          <div class="flex flex-wrap">
            <button
              style="min-width: 200px"
              class="m-1 border-2 border-primored py-6 rounded text-gray-100 font-semibold hover:bg-primored"
              on:click={loadSymbol}
              id="edit-symbol"
              title="Edit the Component">
              <span class="flex items-center justify-center">
                <!-- <svg class="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
              <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
            </svg> -->
                Edit Component
              </span>
            </button>
            <button
              style="min-width: 200px"
              class="m-1 border-2 border-primored py-6 rounded text-gray-100 font-semibold hover:bg-primored"
              on:click={separateFromSymbol}
              title="Separate the Component instance from its Component"
              id="emancipate-symbol">
              <span class="flex items-center justify-center">
                <!-- <svg class="mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.5 2a3.5 3.5 0 101.665 6.58L8.585 10l-1.42 1.42a3.5 3.5 0 101.414 1.414l8.128-8.127a1 1 0 00-1.414-1.414L10 8.586l-1.42-1.42A3.5 3.5 0 005.5 2zM4 5.5a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm0 9a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clip-rule="evenodd" />
              <path d="M12.828 11.414a1 1 0 00-1.414 1.414l3.879 3.88a1 1 0 001.414-1.415l-3.879-3.879z" />
            </svg> -->
                Emancipate
              </span>
            </button>
          </div>
        {:else if !disabled && activeTab === tabs[0]}
          <FullCodeEditor
            variants="flex-1"
            {disabled}
            bind:html={rawHTML}
            bind:css={rawCSS}
            bind:js={rawJS}
            on:save={saveComponent} />
        {:else if activeTab === tabs[1]}
          <div class="fields">
            {#each fields as field, i}
              <Card id="field-{i}" variants="field-item">
                <EditField
                  on:delete={() => deleteField(field.id)}
                  isFirst={i === 0}
                  isLast={i === fields.length - 1}
                  {disabled}
                  minimal={field.type === 'info'}
                  on:move={({ detail: direction }) => moveField( { i, direction } )}>
                  <select
                    bind:value={field.type}
                    slot="type"
                    on:blur={setPlaceholderValues}
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
                    {disabled}
                    on:focus={setPlaceholderValues} />
                  <input
                    class="input key-input"
                    type="text"
                    placeholder="main_heading"
                    bind:value={field.key}
                    on:input={() => (field.key = validateFieldKey(field.key))}
                    slot="key"
                    {disabled}
                    on:input={refreshFields} />
                </EditField>
                {#if field.type === 'group'}
                  {#if field.fields}
                    {#each field.fields as subfield, childIndex}
                      <EditField
                        minimal={field.type === 'info'}
                        child={true}
                        on:move={({ detail: direction }) => moveField( { i, direction, childIndex } )}
                        on:delete={() => deleteSubfield(field.id, subfield.id)}
                        {disabled}>
                        <select
                          bind:value={subfield.type}
                          slot="type"
                          {disabled}>
                          {#each $fieldTypes as field}
                            <option value={field.id}>{field.label}</option>
                          {/each}
                        </select>
                        <!-- <select
                          value={subfield.type}
                          on:change={({ target }) => updateSubfield( field, { ...subfield, type: target.value } )}
                          slot="type"
                          {disabled}>
                          {#each $fieldTypes as field}
                            <option value={field.id}>{field.label}</option>
                          {/each}
                        </select> -->
                        <textarea
                          slot="main"
                          class="info"
                          bind:value={field.value} />
                        <input
                          class="label-input"
                          type="text"
                          placeholder="Heading"
                          bind:value={subfield.label}
                          slot="label"
                          {disabled} />
                        <input
                          class="key-input"
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
                    {disabled}><i class="fas fa-plus mr-2" />Create Subfield</button>
                {:else if field.type === 'repeater'}
                  {#if field.fields}
                    {#each field.fields as subfield}
                      <EditField
                        minimal={field.type === 'info'}
                        child={true}
                        on:move={({ detail: direction }) => moveField( { i, direction, childIndex } )}
                        on:delete={() => deleteSubfield(field.id, subfield.id)}
                        {disabled}>
                        <select
                          bind:value={subfield.type}
                          slot="type"
                          {disabled}>
                          {#each $fieldTypes as field}
                            <option value={field.id}>{field.label}</option>
                          {/each}
                        </select>
                        <textarea
                          slot="main"
                          class="info"
                          bind:value={field.value} />
                        <input
                          class="label-input"
                          type="text"
                          placeholder="Heading"
                          bind:value={subfield.label}
                          slot="label"
                          {disabled} />
                        <input
                          class="key-input"
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
                    {disabled}><i class="fas fa-plus mr-2" />Create Subfield</button>
                {/if}
              </Card>
            {/each}
            <PrimaryButton on:click={addNewField} {disabled}>
              <i class="fas fa-plus" />Create a Field
            </PrimaryButton>
          </div>
        {/if}
      {:else}
        <div class="space-y-2 h-full">
          {#each fields as field}
            {#if field.key && getFieldComponent(field)}
              <div
                class="field-item shadow"
                class:repeater={field.key === 'repeater'}
                id="field-{field.key}">
                <svelte:component
                  this={getFieldComponent(field)}
                  {field}
                  on:input={refreshFields} />
              </div>
            {:else if getFieldComponent(field)}
              <div class="invalid-field">
                <span>This field needs a key in order to be valid</span>
              </div>
            {/if}
          {:else}
            <p class="empty-description">
              You'll need to create and integrate a field before you can edit
              this component's content from here
            </p>
          {/each}
        </div>
      {/if}
    </div>
    <div slot="right">
      <CodePreview
        view="small"
        {loading}
        {componentApp}
        {fields}
        {error}
        id={localComponent.id} />
    </div>
  </HSplitPane>
</main>

<style lang="postcss">
  main {
    display: flex; /* to help w/ positioning child items in code view */
    background: var(--primo-color-black);
    padding: 0.5rem;
    padding-top: 0;
    flex: 1;
    overflow: hidden;

    --PrimaryButton-bg: var(--color-gray-8);
    --PrimaryButton-bg-hover: var(--color-gray-9);

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

    .invalid-field {
      display: block;
      padding: 1rem;
      color: var(--color-gray-1);
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
  .fields {
    display: flex;
    flex-direction: column;

    i {
      margin-right: 0.5rem;
    }
  }
  [slot='left'] {
    overflow: scroll;
    height: 100%;
  }
  [slot='right'] {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  button.convert {
    padding: 4px 12px;
    margin-right: 4px;
    font-size: var(--font-size-2);
    border-radius: var(--border-radius);
    transition: var(--transition-colors);
    border: 1px solid var(--primo-color-primored);
    color: var(--primo-color-primored);
    outline-color: var(--primo-color-primored);

    i {
      margin-right: 4px;
    }
  }
  button.convert:hover {
    background: var(--primo-color-primored-dark);
    color: var(--primo-color-white);
  }
  .field-item {
    padding: 16px;
    box-shadow: var(--box-shadow);
    background: var(--color-gray-9);
    color: var(--color-gray-2);
  }
  .field-button {
    width: 100%;
    background: var(--color-gray-8);
    color: var(--color-gray-3);
    padding: 8px 0;
    border-bottom-right-radius: var(--border-radius);
    border-bottom-left-radius: var(--border-radius);
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
    margin-left: 1.5rem;
    margin-top: 8px;
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

  input {
    background: var(--color-gray-7);
    color: var(--color-gray-2);
    padding: 4px;
    border-radius: 2px;
    border: 0;
    padding: 0.5rem;
  }
  input:focus {
    outline: 0;
  }

</style>
