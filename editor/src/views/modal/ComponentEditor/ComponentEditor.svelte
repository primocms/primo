<script lang="ts">
  import { cloneDeep, find, isEqual, chain as _chain, set as _set } from 'lodash-es';
  import HSplitPane from './HSplitPane.svelte';
  import { hydrateFieldsWithPlaceholders, getPlaceholderValue } from '../../../utils';
  import ModalHeader from '../ModalHeader.svelte';
  import { PrimaryButton } from '../../../components/buttons';
  import { Tabs, Card } from '../../../components/misc';
  import FullCodeEditor from './FullCodeEditor.svelte';
  import { CodePreview } from '../../../components/misc';
  import RepeaterField from '../../../components/FieldTypes/RepeaterField.svelte';
  import GroupField from '../../../components/FieldTypes/GroupField.svelte';
  import {Field} from '../../../const'
  import FieldItem from './FieldItem.svelte'

  import {
    convertFieldsToData,
    createDebouncer,
    processCode,
    processCSS,
    wrapInStyleTags,
  } from '../../../utils';
  import { locale } from '../../../stores/app/misc';

  import { content, code as siteCode } from '../../../stores/data/draft';
  import {
    id as pageID,
    code as pageCode
  } from '../../../stores/app/activePage';
  import { showingIDE } from '../../../stores/app';
  import fieldTypes from '../../../stores/app/fieldTypes';
  import modal from '../../../stores/app/modal';
  import { Component } from '../../../const';
  import type { Component as ComponentType, Symbol as SymbolType } from '../../../const';
  import { symbols } from '../../../stores/actions';
  import { getAllFields, getSymbol } from '../../../stores/helpers';

  // This is the only way I could figure out how to get lodash's debouncer to work correctly
  const quickDebounce = createDebouncer(200);

  export let component:ComponentType|SymbolType = Component();
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

  let localComponent = cloneDeep(component)
  let localContent = component.type === 'symbol' ? null : getComponentContent($content)

  function getComponentContent(siteContent) {
    return _chain(Object.entries(siteContent)) 
      .map(item => {
        const [ locale, pages ] = item
        return {
          locale,
          content: pages[$pageID][component.id] || {}
        }
      })
      .keyBy('locale')
      .mapValues('content')
      .value()
  }
  
  $: $locale, setupComponent()
  function setupComponent() {
    localComponent = getComponentFieldValues(localComponent)
    fields = component.type === 'symbol' ? hydrateFieldsWithPlaceholders(fields) : getFieldValues(localComponent.fields)
  }

  function getComponentFieldValues(component) {
    return cloneDeep({
      ...component,
      fields: component.type === 'symbol' ? hydrateFieldsWithPlaceholders(component.fields) : getFieldValues(component.fields)
    })
  }

  function getFieldValues(fields) {
    return fields.map(field => ({
      ...field,
      value: localContent[$locale][field.key] || getPlaceholderValue(field)
    }))
  }

  // TODO: 
  // Ensure component is not recompiled when changing content

  function saveLocalContent() {
    localContent = {
      ...localContent,
      [$locale]: {
        ...localContent[$locale],
        ..._chain(fields).keyBy('key').mapValues('value').value()
      }
    }
  }

  function saveLocalValue(property:'html'|'css'|'js'|'fields', value:any) {
    if (property === 'fields') {
      localComponent.fields = getFieldValues(value)
      fields = getFieldValues(value)
    } else {
      localComponent.code[property] = value
    }
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

  let rawHTML = localComponent.code.html;
  let rawCSS = localComponent.code.css;
  let rawJS = localComponent.code.js;
  let fields = localComponent.fields;

  let componentApp;
  let error;
  $: compileComponentCode({
    html: rawHTML,
    css: rawCSS,
    js: rawJS,
    fields
  });

  let disableSave = false;
  async function compileComponentCode({ html, css, js, fields }) {
    disableSave = true;
    const allFields = getAllFields(fields);
    const data = convertFieldsToData(allFields);

    // automatically create fields for keys without fields
    // TODO: prevent creating multiple fields for the same key (e.g. when typing {} first then {heading})
    // account for keys passed down from page/site fields
    // allow user to delete fields, even if the key is still used in the html (i.e. don't recreate them)

    // const keys = html.match(/(?<=\{\s*).*?(?=\s*\})/gs) || []// extract keys 
    // const notInFields = keys.map(s => s.replace(/\s/g, '')).filter(s => !find(fields, ['key', s]))
    // notInFields.forEach(key => {
    //   addNewField({ 
    //     key,
    //     label: capitalize(key)
    //   })
    // })

    await compile();
    disableSave = false;

    async function compile() {
      const parentCSS = await processCSS($siteCode.css + $pageCode.css)
      const res = await processCode({
        code: {
          html: `${html}
      <svelte:head>
        ${$pageCode.html.head}
        ${$siteCode.html.head}
        ${wrapInStyleTags(parentCSS)}
      </svelte:head>
      ${$pageCode.html.below}
      ${$siteCode.html.below}
      `,
          css,
          js,
        },
        data,
        buildStatic: false,
      });
      error = res.error;
      componentApp = res.js;
      saveLocalValue('html', html);
      saveLocalValue('css', css);
      saveLocalValue('js', js);
    }
  }

  function addNewField(field = {}) {
    saveLocalValue('fields', [
      ...fields,
      Field(field)
    ]);
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

    saveLocalValue('fields', updatedFields);
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

  // function deleteSubfield(fieldId, subfieldId) {
  //   saveLocalValue('fields', fields.map((field) =>
  //     field.id !== fieldId
  //       ? field
  //       : {
  //           ...field,
  //           fields: field.fields.filter(
  //             (subfield) => subfield.id !== subfieldId
  //           ),
  //         }
  //   ));
  // }


  function deleteSubfield({detail:field}) {

    let subfield = cloneDeep(field)

    // const{subfield, field} = detail
    const idPath = getFieldPath(fields, field.id)

    console.log('subfield:', subfield.id)
    console.log('field:', field)
    console.log('idPath:', idPath)
    console.log('fields:', fields)

    let updatedFields = cloneDeep(fields)

    // get parent field of subfield, set equal to `field`

    handleDeleteSubfield(fields)

    function handleDeleteSubfield(fieldsToModify) {

      console.log('fieldsToModify:', fieldsToModify)

      if (find(fieldsToModify, ['id', field.id])) { // field is at this level
        const newField = cloneDeep(field)
        newField.fields = newField.fields.filter(
          (field) => field.id !== subfield.id
        )
        console.log({newField})
        _set(updatedFields, idPath, newField)
      } else { // field is lower
        fieldsToModify.forEach(field => handleDeleteSubfield(field.fields));
      }

    saveLocalValue('fields', updatedFields);
  }
}

  function deleteField({ detail: field }) {
    saveLocalValue('fields', fields.filter((f) => f.id !== field.id));
    // TODO: handle deleting subfields ()
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

  function getFieldComponent(field) {
    const fieldType = find(allFieldTypes, ['id', field.type]);
    if (fieldType && fieldType.component) {
      return fieldType.component;
    } else {
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

    saveLocalValue('fields', updatedFields)
  }

  let editorWidth = localStorage.getItem('editorWidth') || '66%';
  let previewWidth = localStorage.getItem('previewWidth') || '33%';

  // function validateFieldKey(key) {
  //   // replace dash and space with underscore
  //   return key.replace(/-/g, '_').replace(/ /g, '_').toLowerCase();
  // }

  function refreshPreview() {
    fields = fields.filter(Boolean)
  }

  function saveComponent() {
    if (!disableSave) {
      const component = extractComponent(localComponent)
      header.button.onclick(component);
    }
  }

  function extractComponent(component) {
    return {
      ...component,
      content: localContent,
      fields: fields.map(field => ({
        id: field.id,
        key: field.key,
        label: field.label,
        type: field.type,
        fields: field.fields
      }))
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
</ModalHeader>

<main>
  <HSplitPane
    leftPaneSize={editorWidth}
    rightPaneSize={previewWidth}
    styleLeft="overflow: { $showingIDE ? 'hidden' : 'scroll' }"
    on:resize={({ detail }) => {
      const { left, right } = detail;
      localStorage.setItem('editorWidth', left);
      localStorage.setItem('previewWidth', right);
    }}>
    <div slot="left" lang={$locale}>
      {#if $showingIDE}
        <Tabs {tabs} bind:activeTab />
        {#if activeTab === tabs[0]}
          <FullCodeEditor
            variants="flex-1"
            bind:html={rawHTML}
            bind:css={rawCSS}
            bind:js={rawJS}
            on:save={saveComponent} />
        {:else if activeTab === tabs[1]}
          <div class="fields">
            {#each fields as field, i}
              <Card id="field-{i}">
                <FieldItem 
                  bind:field
                  isFirst={i === 0}
                  isLast={i === fields.length - 1}
                  on:delete={deleteSubfield}
                  on:move={moveField}
                  on:createsubfield={createSubfield}
                  on:input={() => fields = fields.filter(Boolean)}
                />
              </Card>
            {/each}
            <PrimaryButton on:click={addNewField}>
              <i class="fas fa-plus" />Create a Field
            </PrimaryButton>
          </div>
        {/if}
      {:else}
        <div>
          <!-- use key so repeater fields update when changing locale -->
          {#each fields as field} 
            {#if field.key && getFieldComponent(field)}
              <div
                class="field-item"
                class:repeater={field.key === 'repeater'}
                id="field-{field.key}">
                <svelte:component
                  on:input={() => {
                    refreshPreview()
                    saveLocalContent()
                  }}
                  this={getFieldComponent(field)}
                  {field} />
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
        {error} />
    </div>
  </HSplitPane>
</main>

<style lang="postcss">
  main {
    display: flex; /* to help w/ positioning child items in code view */
    background: var(--primo-color-black);
    color: var(--color-gray-2);
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
  }

  .field-item {
    padding: 1rem;
    box-shadow: var(--box-shadow);
    margin-bottom: 0.5rem;
    background: var(--color-gray-9);
  }

  [slot="right"] {
    width: 100%;
  }

</style>
