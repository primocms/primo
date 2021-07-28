<script>
  import _ from 'lodash';
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
  const quickDebounce = createDebouncer(500);

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

  let localComponent = _.cloneDeep(component);
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
    fields,
  });
  async function compileComponentCode({ html, css, js, fields }) {
    const allFields = getAllFields(fields);
    const data = convertFieldsToData(allFields);
    const res = await processCode({
      code: {
        html: `${html}
      <svelte:head>
        ${$pageHTML.head}
        ${$siteHTML.head}
        ${wrapInStyleTags($siteCSS + $pageCSS)}
      </svelte:head>
      `,
        css,
        js,
      },
      data,
      buildStatic: false,
    });
    error = res.error;
    componentApp = res.js;
    saveRawValue('html', html);
    saveRawValue('css', css);
    saveRawValue('js', js);
  }

  let rawHTML = localComponent.value.html;
  let rawCSS = localComponent.value.css;
  let rawJS = localComponent.value.js;

  async function updateHtmlWithFieldData() {
    refreshFields();
  }

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
    header.button.onclick(localComponent);
    loadSymbol();
  }

  function separateFromSymbol() {
    localComponent.symbolID = null;
    disabled = false;
  }

  async function loadSymbol() {
    disabled = false;
    const symbol = getSymbol(localComponent.symbolID);
    localComponent = _.cloneDeep(symbol);
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
    updateHtmlWithFieldData();
    saveRawValue('fields', fields);
  }

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
    updateHtmlWithFieldData();
    saveRawValue('fields', fields);
  }

  function deleteField(id) {
    fields = fields.filter((field) => field.id !== id);
    updateHtmlWithFieldData();
    saveRawValue('fields', fields);
  }

  function refreshFields() {
    // necessary to re-render field values in preview (since we're mutating `field`)
    fields = fields.filter(Boolean);
    saveRawValue('fields', fields);
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
    updateHtmlWithFieldData();
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
    const fieldType = _.find(allFieldTypes, ['id', field.type]);
    if (fieldType && fieldType.component) {
      return fieldType.component;
    } else {
      return null;
    }
  }

  function moveEditField({ i: indexOfItem, direction }) {
    const item = fields[indexOfItem];
    const withoutItem = fields.filter((_, i) => i !== indexOfItem);
    if (direction === 'up') {
      fields = [
        ...withoutItem.slice(0, indexOfItem - 1),
        item,
        ...withoutItem.slice(indexOfItem - 1),
      ];
    } else if (direction === 'down') {
      fields = [
        ...withoutItem.slice(0, indexOfItem + 1),
        item,
        ...withoutItem.slice(indexOfItem + 1),
      ];
    } else {
      console.error('Direction must be up or down');
    }
  }

  if (localComponent.symbolID && $switchEnabled) {
    loadSymbol();
  }

  let editorWidth = localStorage.getItem('editorWidth') || '66%';
  let previewWidth = localStorage.getItem('previewWidth') || '33%';

</script>

<ModalHeader
  {...header}
  warn={() => {
    if (!_.isEqual(localComponent, component)) {
      const proceed = window.confirm('Undrafted changes will be lost. Continue?');
      return proceed;
    } else return true;
  }}
  button={{ ...header.button, onclick: () => header.button.onclick(localComponent), disabled: disableSave }}>
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
    <div slot="left" class="h-full">
      <div class="mb-4 lg:mb-0 w-full h-full">
        <div class="flex flex-col h-full overflow-y-scroll">
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
                on:save={() => header.button.onclick(localComponent)} />
            {:else if activeTab === tabs[1]}
              <div class="fields">
                {#each fields as field, i (field.id)}
                  <Card id="field-{i}" variants="field-item">
                    <EditField
                      on:delete={() => deleteField(field.id)}
                      isFirst={i === 0}
                      isLast={i === fields.length - 1}
                      {disabled}
                      minimal={field.type === 'info'}
                      on:move={({ detail: direction }) => moveEditField( { i, direction } )}>
                      <select
                        bind:value={field.type}
                        slot="type"
                        on:blur={setPlaceholderValues}
                        {disabled}>
                        {#each allFieldTypes as field}
                          <option value={field.id}>{field.label}</option>
                        {/each}
                      </select>
                      <textarea
                        slot="main"
                        class="info"
                        bind:value={field.value} />
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
                        slot="key"
                        {disabled}
                        on:input={updateHtmlWithFieldData} />
                    </EditField>
                    {#if field.type === 'group'}
                      {#if field.fields}
                        {#each field.fields as subfield}
                          <EditField
                            minimal={field.type === 'info'}
                            variants="ml-4 text-sm"
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
                    {:else if field.type === 'repeater'}
                      {#if field.fields}
                        {#each field.fields as subfield}
                          <EditField
                            minimal={field.type === 'info'}
                            variants="ml-4 text-sm"
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
                      on:input={updateHtmlWithFieldData} />
                  </div>
                {:else if getFieldComponent(field)}
                  <span>This field needs a key in order to be valid</span>
                {/if}
              {:else}
                <p
                  class="text-center h-full flex items-start p-24 justify-center
                  text-lg text-gray-200 mt-3">
                  You'll need to create and integrate a field before you can
                  edit this component's content
                </p>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
    <div slot="right">
      <CodePreview view="small" {loading} {componentApp} {error} />
    </div>
  </HSplitPane>
</main>

<style lang="postcss">
  main {
    background: var(--color-black);
    padding: 0.5rem;
    flex: 1;

    --PrimaryButton-bg: var(--color-gray-8);
    --PrimaryButton-bg-hover: var(--color-gray-9);
  }
  .fields {
    display: flex;
    flex-direction: column;

    i {
      margin-right: 0.5rem;
    }
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
    border: 1px solid var(--color-primored);
    color: var(--color-primored);
    outline-color: var(--color-primored);

    i {
      margin-right: 4px;
    }
  }
  button.convert:hover {
    background: var(--color-primored-dark);
    color: var(--color-white);
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
    width: calc(100% - 2rem);
    border-radius: 2px;
    margin-left: auto;
    margin-top: 8px;
    font-size: var(--font-size-2);
    background: var(--color-codeblack);
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
  }
  input:focus {
    outline: 0;
  }

  select {
    width: 100%;
    padding: 8px;
    border-right: 4px solid transparent;
    background: var(--color-gray-9);
    color: var(--color-gray-2);
    font-size: var(--font-size-2);
    font-weight: 600;
    border: 0;
  }

</style>
