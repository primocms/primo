<script lang="ts">
  import _ from "lodash";
  import ShortUniqueId from "short-unique-id";
  import { onMount } from "svelte";

  import ModalHeader from "../ModalHeader.svelte";
  import { EditField } from "../../../components/inputs";
  import { PrimaryButton } from "../../../components/buttons";
  import { Tabs } from "../../../components/misc";
  import { CodeMirror } from "../../../components";
  import { Card } from "../../../components/misc";
  import FullCodeEditor from "./FullCodeEditor.svelte";
  import { CodePreview } from "../../../components/misc";
  import RepeaterField from '../../../components/FieldTypes/RepeaterField.svelte'
  import GroupField from '../../../components/FieldTypes/GroupField.svelte'

  import {
    convertFieldsToData,
    createDebouncer,
  } from "../../../utils";

  import { styles as siteStyles, fields as siteFields } from "../../../stores/data/draft";
  import {fields as pageFields, styles as pageStyles, dependencies as pageDependencies} from "../../../stores/app/activePage"
  import {content} from "../../../stores/app/activePage"
  // import {symbols} from "../../../stores/data/draft";
  import { switchEnabled } from "../../../stores/app";
  import fieldTypes from "../../../stores/app/fieldTypes";
  import modal from "../../../stores/app/modal";
  import { createComponent } from "../../../const";
  import {updateInstances,symbols} from '../../../stores/actions'
  import {getAllFields,getSymbol} from '../../../stores/helpers'
  import {processors} from '../../../component'

  // This is the only way I could figure out how to get lodash's debouncer to work correctly
  const slowDebounce = createDebouncer(1000);
  const quickDebounce = createDebouncer(500);

  import type {
    Fields,
    Component,
    Property,
    FieldType,
  } from "../../../types/components";

  //TODO: CreateComponent needs to have a type defined, where the prop  type is fixed to be "component"
  export let component: Component = createComponent();
  export let header = {
    label: "Create Component",
    icon: "fas fa-code",
    button: {
      icon: "fas fa-plus",
      label: "Add to page",
      onclick: (param: Component) => true,
    },
  };

  let localComponent: Component = _.cloneDeep(component);

  function saveRawValue(property: Property, value: any): void {
    localComponent.value.raw[property] = value;
  }

  function saveFinalValue(property: Property, value: string): void {
    localComponent.value.final[property] = value;
  }

  const allFieldTypes = [
    {
      id: 'repeater',
      label: 'Repeater',
      component: RepeaterField
    },
    {
      id: 'group',
      label: 'Group',
      component: GroupField
    },
    ...$fieldTypes
  ]

  let loading:boolean = false;

  let fields:Fields = localComponent.value.raw.fields;

  let rawHTML:string = localComponent.value.raw.html;
  let finalHTML:string = localComponent.value.final.html;
  $: compileHtml(rawHTML);
  async function compileHtml(html: string): Promise<void> {
    loading = true;
    saveRawValue("html", html);
    const res = await processors.html(rawHTML, componentData)
    if (res.error) {
      disableSave = true
      res = `<pre class="flex justify-start p-8 items-start bg-red-100 text-red-900 h-screen font-mono text-xs lg:text-sm xl:text-md">${res.error}</pre>`
    } else {
      disableSave = false
      finalHTML = res
    }
    saveFinalValue("html", finalHTML);
    if(finalJS) {
      finalJS = `${finalJS} // ${getUniqueId()}` // force preview to reload so JS evaluates over new DOM
    }
    quickDebounce([() => {
      loading = false
    }, null])
  }

  let rawCSS:string = localComponent.value.raw.css;
  let finalCSS:string = localComponent.value.final.css;
  // $: compileCss(rawCSS)
  $: quickDebounce([compileCss, rawCSS]);
  $: ((css) => {
    loading = true;
  })(rawCSS);
  async function compileCss(css: string): Promise<void> {
    saveRawValue("css", css);
    loading = true;
    const encapsulatedCss:string = `#component-${localComponent.id} {${css}}`;
    const result:string = await processors.css(encapsulatedCss, {
      html: localComponent.value.final.html,
      tailwind: $siteStyles.tailwind
    })

    if (result.error) {
      disableSave = true
      finalHTML = `<pre class="flex justify-start p-8 items-start bg-red-100 text-red-900 h-screen font-mono text-xs lg:text-sm xl:text-md">${result.error}</pre>`
    } else if (result) {
      disableSave = false
      finalHTML = localComponent.value.final.html
      finalCSS = result;
      saveFinalValue("css", finalCSS);
    }
    loading = false;
  }

  let rawJS: string = localComponent.value.raw.js;
  let finalJS: string = localComponent.value.final.js;
  $: compileJs(rawJS);
  async function compileJs(js: string): Promise<void> {
    finalJS = js ? `
      const primo = {
        id: '${localComponent.id}',
        data: ${JSON.stringify(getData(fields))},
        fields: ${JSON.stringify(getAllFields(fields))}
      }
      // turn [import _ from 'lodash'] into [import _ from 'https://cdn.skypack.dev/lodash'];
      ${js.replace(/(?:import )(\w+)(?: from )['"]{1}(?!http)(.+)['"]{1}/g,`import $1 from 'https://cdn.skypack.dev/$2'`)} 
    `: ``;
    saveRawValue("js", js);
    saveFinalValue("js", finalJS);
  }

  let componentData = getData(fields)
  $: componentData = getData(fields)
  function getData(fields) {
    const allFields: Fields = getAllFields(fields);
    const data = convertFieldsToData(allFields);
    return {
      ...data,
      id: component.id
    }
  }

  async function updateHtmlWithFieldData(): Promise<void> {
    loading = true;
    finalHTML = await processors.html(rawHTML, getData(fields));
    saveFinalValue("html", finalHTML);
    refreshFields();
    if (rawJS) compileJs(rawJS) // re-run js with new field values
    quickDebounce([
      () => {
        loading = false;
      },
    ]);
  }

  let isSingleUse:boolean = false
  $: isSingleUse = localComponent.type === 'component' && localComponent.symbolID === null 
  function convertToSymbol() {
    const newSymbol = { 
      ...localComponent, 
      id: getUniqueId(),
      type: 'symbol'
    }
    delete newSymbol.symbolID
    symbols.create(newSymbol)
    localComponent.symbolID = newSymbol.id
    header.button.onclick(localComponent)
    loadSymbol()
  }

  function separateFromSymbol(): void {
    localComponent.symbolID = null;
    disabled = false;
  }

  async function loadSymbol(): Promise<void> {
    disabled = false;
    const symbol: Component = getSymbol(localComponent.symbolID)
    localComponent = _.cloneDeep(symbol)
    modal.show("COMPONENT_EDITOR", {
      component: symbol,
      header: {
        title: `Edit ${symbol.title || "Symbol"}`,
        icon: "fas fa-th-large",
        button: {
          icon: "fas fa-check",
          label: `Draft`,
          onclick: async (symbol) => {
            loading = true;
            symbols.update(symbol)
            updateInstances(symbol);
            modal.hide();
          },
        },
      },
    });
  }

  function addNewField(): void {
    fields = [...fields, createField()];
    saveRawValue("fields", fields);

    function createField() {
      return {
        id: getUniqueId(),
        key: "",
        label: "",
        value: "",
        type: "text",
        fields: [],
      };
    }
  }

  function getUniqueId() {
    return new ShortUniqueId().randomUUID(5).toLowerCase();
  }

  function addSubField(id: string): void {
    fields = fields.map((field) => ({
      ...field,
      fields:
        field.id === id
          ? [
              ...field.fields,
              {
                id: getUniqueId(),
                key: "",
                label: "",
                value: "",
                type: "text",
              },
            ]
          : field.fields,
    }));
    updateHtmlWithFieldData();
    saveRawValue("fields", fields);
  }

  function deleteSubfield(fieldId: string, subfieldId: string): void {
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
    saveRawValue("fields", fields);
  }

  function deleteField(id: string): void {
    fields = fields.filter((field) => field.id !== id);
    updateHtmlWithFieldData();
    saveRawValue("fields", fields);
  }

  function refreshFields(): void { // necessary to re-render field values in preview (since we're mutating `field`)
    fields = fields.filter(Boolean);
    saveRawValue("fields", fields);
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
          alt: ''
        },
      }[type] || ""
    );
  }

  const tabs = [
    {
      id: "code",
      label: "Code",
      icon: "code",
    },
    {
      id: "fields",
      label: "Fields",
      icon: "database",
    },
  ];

  let activeTab = tabs[0];

  let disabled:boolean = false
  $: disabled = !!localComponent.symbolID;
  let disableSave = false

  function getFieldComponent(field) {
    const fieldType = _.find(allFieldTypes, ['id', field.type])
    if (fieldType && fieldType.component) {
      return fieldType.component
    } else {
      return null
    }
  }


  function moveEditField({ i:indexOfItem, direction }) {
    const item = fields[indexOfItem]
    const withoutItem = fields.filter((_, i) => i !== indexOfItem)
    if (direction === 'up') {
      fields = [...withoutItem.slice(0,indexOfItem-1), item, ...withoutItem.slice(indexOfItem-1)];
    } else if (direction === 'down') {
      fields = [...withoutItem.slice(0, indexOfItem+1), item, ...withoutItem.slice(indexOfItem+1)];
    } else {
      console.error('Direction must be up or down')
    }
  }

</script>

<ModalHeader
  {...header}
  button={{ 
    ...header.button, 
    onclick: () => header.button.onclick(localComponent) ,
    disabled: disableSave
  }}>
  {#if isSingleUse}
    <button class="convert" on:click={convertToSymbol}>
      <i class="fas fa-clone"></i>
      <span>Convert to Symbol</span>
    </button>
  {/if}
</ModalHeader>

<div class="flex flex-col lg:flex-row flex-1 flex-wrap">
  <div class="w-full mb-4 lg:mb-0 lg:w-1/2">
    <div class="flex flex-col h-full">
      {#if $switchEnabled}
        <Tabs {tabs} bind:activeTab variants="mt-2 mb-1" />
        {#if disabled}
          <p class="mb-2 text-xs text-gray-700">
            This component is tied to a <button
              class="underline"
              on:click={loadSymbol}
              id="edit-symbol"
              title="Edit the Symbol">Symbol</button>. You won't be able to edit
            it unless you <button
              class="underline"
              on:click={separateFromSymbol}
              title="Separate the component instance from its Symbol"
              id="emancipate-symbol">emancipate it</button>.
          </p>
        {/if}
        {#if activeTab === tabs[0]}
          <FullCodeEditor
            variants="flex-1"
            {disabled}
            bind:html={rawHTML}
            bind:css={rawCSS}
            bind:js={rawJS}
            on:save={() => header.button.onclick(localComponent)} />
        {:else if activeTab === tabs[1]}
          <div class="flex flex-col">
            {#each fields as field, i (field.id)}
              <Card id="field-{i}" variants="field-item">
                <EditField 
                  on:delete={() => deleteField(field.id)} 
                  isFirst={i === 0}
                  isLast={i === (fields.length-1)}
                  {disabled} 
                  on:move={({ detail:direction }) => moveEditField({ i, direction })}
                >
                  <select
                    bind:value={field.type}
                    slot="type"
                    on:blur={setPlaceholderValues}
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
                    {disabled}
                    on:focus={setPlaceholderValues} />
                  <input
                    class="input key-input"
                    type="text"
                    placeholder="main-heading"
                    bind:value={field.key}
                    slot="key"
                    {disabled}
                    on:input={updateHtmlWithFieldData} />
                </EditField>
                {#if field.type === 'group'}
                  {#if field.fields}
                    {#each field.fields as subfield}
                      <EditField
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
            <PrimaryButton
              variants="field-button"
              on:click={addNewField}
              {disabled}>
              <i class="fas fa-plus mr-2" />Create a Field
            </PrimaryButton>
          </div>
        {/if}
      {:else}
        <div class="pt-8">
          {#each fields as field}
            {#if field.key && getFieldComponent(field)}
              <div class="field-item mb-2 shadow" id="field-{field.key}">
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
                text-lg text-gray-700 mt-3 bg-gray-100">
              You'll need to create and integrate a field before you can edit
              this component's content
            </p>
          {/each}
        </div>
      {/if}
    </div>
  </div>
  <div class="flex-1 w-full lg:w-1/2">
    <CodePreview
      view="small"
      {loading}
      id={localComponent.id}
      html={finalHTML}
      css={$siteStyles.final + $pageStyles.final + finalCSS}
      js={finalJS}
      includeParentStyles />
  </div>
</div>

<style>
  button.convert {
    @apply py-1 px-3 mr-2 text-sm rounded transition-colors duration-200 border border-primored text-primored;
    outline-color: rgb(248,68,73);
    &:hover {
      @apply bg-red-700 text-white;
    }
  }
  .field-item {
    @apply p-4 shadow mb-2 bg-white;
  }
  .field-button {
    @apply w-full bg-gray-800 text-gray-300 py-2 rounded font-medium transition-colors duration-100;

    &:hover {
      @apply bg-gray-900;
    }
    &[disabled] {
      @apply bg-gray-500;
      @apply cursor-not-allowed;
    }
  }
  .field-button.subfield-button {
    width: calc(100% - 1rem);
    @apply ml-4 mb-2 mt-2 text-sm py-1 bg-gray-100 text-gray-700 transition-colors duration-100 outline-none;

    &:hover {
      @apply bg-gray-300;
    }
    &:focus {
      @apply bg-gray-200;
    }
  }

  input {
    &:focus {
      @apply outline-none;
    }
  }

  select {
    outline-offset: 3px;
    outline-color: rgb(248, 68, 73);
    padding: 0.5rem;
    border-right-width: 0.5rem;
    @apply p-2 border-transparent text-sm font-semibold;
  }

  @import "../../../node_modules/bulma/sass/utilities/_all.sass";
  @import "../../../node_modules/bulma/sass/form/_all.sass";
</style>