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

  import {
    parseHandlebars,
    convertFieldsToData,
    processStyles,
    createDebouncer,
  } from "../../../utils";

  import site from "../../../stores/data/site";
  import {fields as pageFields, dependencies as pageDependencies} from "../../../stores/app/activePage"
  import {content} from "../../../stores/app/activePage"
  import {symbols} from "../../../stores/data/draft";
  import { editorViewDev } from "../../../stores/app";
  import fieldTypes from "../../../stores/app/fieldTypes";
  import modal from "../../../stores/app/modal";
  import { createComponent } from "../../../const";
  import {updateInstances} from '../../../stores/actions'

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

  function getAllFields() {
    const allFields = _.unionBy(fields, $pageFields, $site.fields, "key");
    return allFields;
  }

  let loading: boolean = false;

  let fields: Fields = localComponent.value.raw.fields;

  let rawHTML: string = localComponent.value.raw.html;
  let finalHTML: string = localComponent.value.final.html;
  $: compileHtml(rawHTML);
  async function compileHtml(html: string): Promise<void> {
    loading = true;
    saveRawValue("html", html);
    const allFields = getAllFields();
    const data = await convertFieldsToData(allFields, "all");
    const processedHTML = await parseHandlebars(rawHTML, data);
    finalHTML = processedHTML;
    quickDebounce([
      () => {
        loading = false;
      },
    ]);
    saveFinalValue("html", finalHTML);
  }

  let rawCSS: string = localComponent.value.raw.css;
  let finalCSS: string = localComponent.value.final.css;
  // $: compileCss(rawCSS)
  $: slowDebounce([compileCss, rawCSS]);
  $: ((css) => {
    loading = true;
  })(rawCSS);
  async function compileCss(css: string): Promise<void> {
    saveRawValue("css", css);
    loading = true;
    const encapsulatedCss: string = `#component-${localComponent.id} {${css}}`;
    const result: string = await processStyles(
      encapsulatedCss,
      localComponent.value.final.html,
      {
        tailwindConfig: $site.styles.tailwind,
      }
    );
    if (result) {
      finalCSS = result;
      saveFinalValue("css", finalCSS);
    }
    loading = false;
  }

  let rawJS: string = localComponent.value.raw.js;
  let finalJS: string = localComponent.value.final.js;
  $: compileJs(rawJS);
  async function compileJs(js: string): Promise<void> {
    // this is where we can introduce TS/Babel later
    finalJS = js;
    saveRawValue("js", js);
    saveFinalValue("js", finalJS);
  }

  async function updateHtmlWithFieldData(typeToUpdate: string): Promise<void> {
    loading = true;
    const allFields: Fields = getAllFields();
    let data = await convertFieldsToData(allFields, typeToUpdate);
    finalHTML = await parseHandlebars(rawHTML, data);
    saveFinalValue("html", finalHTML);
    refreshFields();
    quickDebounce([
      () => {
        loading = false;
      },
    ]);
  }

  function separateFromSymbol(): void {
    localComponent.symbolID = null;
    disabled = false;
  }

  async function loadSymbol(): Promise<void> {
    disabled = false;
    const symbol: Component = _.find($symbols, ['id', localComponent.symbolID]);
    localComponent = _.cloneDeep(symbol);
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
            $symbols =  $symbols.map(s => s.id === symbol.id ? symbol : s)
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
    updateHtmlWithFieldData("static");
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
    updateHtmlWithFieldData("static");
    saveRawValue("fields", fields);
  }

  function deleteField(id: string): void {
    fields = fields.filter((field) => field.id !== id);
    updateHtmlWithFieldData("static");
    saveRawValue("fields", fields);
  }

  function refreshFields(): void {
    fields = fields.filter((f) => true);
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
    updateHtmlWithFieldData("static");
  }

  function getFakeValue(type) {
    if (!faker) return "";
    return (
      {
        text: faker.lorem.sentence(),
        content: faker.lorem.paragraph(),
        image: faker.image.unsplash.image(),
      }[type] || ""
    );
  }

  const subFieldTypes: Array<FieldType> = $fieldTypes.filter(
    (field) => !["repeater", "group", "api", "js"].includes(field.id)
  );

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

  let disabled: boolean = !!localComponent.symbolID;

  let faker;
  onMount(async () => {
    faker = await import("faker");
  });

  $: console.log(header);
</script>

<style>
  .field-item {
    @apply p-4;
    @apply shadow;
    @apply mb-2;
    @apply bg-white;
  }
  .field-button {
    @apply w-full;
    @apply bg-gray-800;
    @apply text-gray-300;
    @apply py-2;
    @apply rounded;
    @apply font-medium;
    @apply transition-colors;
    @apply duration-100;

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
    @apply ml-4;
    @apply mb-2;
    @apply mt-2;
    @apply text-sm;
    @apply py-1;
    @apply bg-gray-100;
    @apply text-gray-700;
    @apply transition-colors;
    @apply duration-100;
    @apply outline-none;

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
    @apply p-2;
    @apply border-transparent;
    @apply text-sm;
    @apply font-semibold;
  }

  @import "../../../node_modules/bulma/sass/utilities/_all.sass";
  @import "../../../node_modules/bulma/sass/form/_all.sass";
</style>

<ModalHeader
  {...header}
  button={{ ...header.button, onclick: () => header.button.onclick(localComponent) }} />

<div class="flex flex-1 flex-wrap">
  <div class="w-full mb-4 lg:mb-0 lg:w-1/2">
    <div class="flex flex-col h-full">
      {#if $editorViewDev}
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
            {#each fields as field, i}
              <Card id="field-{i}" variants="field-item">
                <EditField on:delete={() => deleteField(field.id)} {disabled}>
                  <select
                    bind:value={field.type}
                    slot="type"
                    on:blur={setPlaceholderValues}
                    {disabled}>
                    {#each $fieldTypes as field}
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
                    on:input={() => updateHtmlWithFieldData('static')} />
                </EditField>
                {#if field.type === 'js'}
                  <CodeMirror
                    {disabled}
                    style="height:25vh"
                    bind:value={field.code}
                    on:change={() => updateHtmlWithFieldData('js')} />
                {:else if field.type === 'group'}
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
                          {#each subFieldTypes as field}
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
                          {#each subFieldTypes as field}
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
                {:else if field.type === 'message'}
                  <textarea
                    {disabled}
                    rows="3"
                    bind:value={field.value}
                    class="w-full border border-solid border-gray-200 rounded" />
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
            {#if field.label && field.key}
              <div class="field-item mb-2 shadow" id="field-{field.key}">
                <svelte:component
                  this={_.find($fieldTypes, ['id', field.type]).component}
                  {field}
                  on:input={() => updateHtmlWithFieldData('static')} />
              </div>
            {:else}
              <span>This field needs a label and key in order to be valid</span>
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
  <div class="w-full lg:w-1/2">
    <CodePreview
      view="small"
      {loading}
      id={localComponent.id}
      html={finalHTML}
      css={finalCSS}
      js={finalJS}
      dependencies={$pageDependencies}
      includeParentStyles />
  </div>
</div>
