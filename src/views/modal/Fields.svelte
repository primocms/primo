<script lang="ts">  
  import _ from 'lodash'
  import pluralize from 'pluralize'
  import {createEventDispatcher} from 'svelte'
  import {fade} from 'svelte/transition'
  const dispatch = createEventDispatcher()
  import {PrimaryButton,SaveButton} from '../../components/buttons'
  import {EditField, GenericField, ImageField} from '../../components/inputs'
  import {IconButton,Tabs} from '../../components/misc'
  import {CodeMirror} from '../../components'
  import {Card} from '../../components/misc'
  import {CodePreview} from '../../components/misc'
  import type {Subfield, Field, Fields, Component, Property, FieldType} from '../../types/components'
  import {getUniqueId} from '../../utils'

  import fieldTypes from '../../stores/app/fieldTypes'
  import site from '../../stores/data/site'
  import pageData from '../../stores/data/pageData'
  import {editorViewDev,userRole} from '../../stores/app'
  import modal from '../../stores/app/modal'
  import content from '../../stores/data/page/content'

  let pageFields = _.cloneDeep($pageData.fields) || []
  let siteFields = _.cloneDeep($site.fields) || []

  let fields = pageFields 

  function saveFields(fields) {
    if (showingPage) {
      pageFields = fields
    } else {
      siteFields = fields
    }
  }

  function addField(): void {
    fields = [
      ...fields,
      {
        id: getUniqueId(),
        key: '',
        label: '',
        value: '',
        type: 'text',
        fields: []
      }
    ]
    saveFields(fields)
  }

  function addSubField(id:string): void {
    fields = fields.map(field => ({
      ...field,
      fields: field.id === id ? [
        ...field.fields,
        {
          id: getUniqueId(),
          key: '',
          label: '',
          value: '',
          type: 'text'
        }
      ] : field.fields
    }))
    saveFields(fields)
    updateHtmlWithFieldData('static')
  }

  function deleteSubfield(fieldId:string, subfieldId:string): void {
    fields = fields.map(field => field.id !== fieldId ? field : {
      ...field,
      fields: field.fields.filter(subfield => subfield.id !== subfieldId)
    })
    saveFields(fields)
    updateHtmlWithFieldData('static')
  }

  function deleteField(id:string): void {
    fields = fields.filter(field => field.id !== id)
    updateHtmlWithFieldData('static')
    saveFields(fields)
  }

  function addRepeaterItem(repeaterField:Field): void {
    const keys = repeaterField.fields.map(f => f.key)
    repeaterField.value = [
      ...repeaterField.value,
      keys.reduce((a,b) => (a[b]='',a), { id: getUniqueId() }) // turn keys into value object
    ]
    refreshFields()
    updateHtmlWithFieldData('static')
  }

  function removeRepeaterItem(fieldId:string, itemId:string): void {
    fields = fields.map(field => field.id !== fieldId ? field : ({
      ...field,
      value: Array.isArray(field.value) ? field.value.filter(item => item.id !== itemId) : field.value
    }))
    refreshFields()
    updateHtmlWithFieldData('static')
  }

  function moveRepeaterItem(field, item, direction): void {
    const indexOfItem:number = _.findIndex(field.value, ['id', item.id])
    const withoutItem:Fields = field.value.filter(i => i.id !== item.id)
    if (direction === 'up') {
      field.value = [...withoutItem.slice(0,indexOfItem-1), item, ...withoutItem.slice(indexOfItem-1)];
    } else {
      field.value = [...withoutItem.slice(0, indexOfItem+1), item, ...withoutItem.slice(indexOfItem+1)];
    }
    refreshFields()
  }

  function refreshFields(): void {
    fields = fields.filter(f => true)
    saveFields(fields)
  }

  const subFieldTypes:Array<FieldType> = $fieldTypes.filter(field => !['repeater','group','api','js'].includes(field.id))

  //// 
  let disabled = false
  function updateHtmlWithFieldData(type) {
    // TODO: update page preview
  }

  const tabs = [
    {
      label: 'Page',
      icon: 'square'
    },
    {
      label: 'Site',
      icon: 'th'
    }
  ]
  let activeTab = tabs[0]

  let showingPage = true
  $: showingPage = activeTab === tabs[0]

  $: if (showingPage) {
    fields = pageFields
  } else {
    fields = siteFields
  }

  function applyFields() {
    site.saveCurrentPage({ fields: pageFields })
    site.save({ fields: siteFields })
    pageData.save('fields', pageFields)
    pageData.hydrateWrapper()
    content.hydrateComponents()
    site.pages.hydrateComponents()
    modal.hide()
  }

</script>

<Tabs {tabs} bind:activeTab variants="mb-2" />

<div class="flex flex-col pt-2">
  {#if $editorViewDev}
    {#each fields as field}
      <Card variants="field-item">
        <EditField on:delete={() => deleteField(field.id)} {disabled}>
          <select bind:value={field.type} slot="type" on:change={refreshFields} {disabled}>
            {#each $fieldTypes as field}
              <option value={field.id}>{ field.label }</option>
            {/each}
          </select>
          <input class="input label-input" type="text" placeholder="Heading" bind:value={field.label} slot="label" {disabled}>
          <input class="input key-input" type="text" placeholder="main-heading" bind:value={field.key} slot="key" {disabled}>
        </EditField>
        {#if field.type === 'api'}
          <div class="field is-horizontal" in:fade={{ duration: 100 }}>
            <div class="flex justify-between items-center">
              <GenericField 
                label="Endpoint" 
                bind:value={field.endpoint} 
                on:input={_.debounce( () => { updateHtmlWithFieldData('api') }, 1000 )}
                input={{
                  type: 'api',
                  placeholder: 'https://jsonplaceholder.typicode.com/todos/1'
                }} 
                {disabled}/>
              <GenericField 
                label="Path" 
                bind:value={field.endpointPath} 
                on:input={_.debounce( () => { updateHtmlWithFieldData('api') }, 1000 )}
                input={{
                  type: 'text',
                  placeholder: `2.prop.5['another-prop']`
                }} 
                {disabled}/>
                <IconButton title="Open browser console to monitor data" icon="sync-alt" variants="is-link is-outlined" on:click={() => updateHtmlWithFieldData('api')} {disabled} />
            </div>
          </div>
        {:else if field.type === 'js'}
          <CodeMirror 
            {disabled}
            mode="javascript" 
            style="height:25vh" 
            bind:value={field.code} 
            on:change={() => updateHtmlWithFieldData('js')} 
          />
        {:else if field.type === 'group'}
          {#if field.fields}
            {#each field.fields as subfield}
              <EditField fieldTypes={subFieldTypes} on:delete={() => deleteSubfield(field.id, subfield.id)} {disabled}>
                <select bind:value={subfield.type} slot="type" {disabled}>
                  {#each subFieldTypes as field}
                    <option value={field.id}>{ field.label }</option>
                  {/each}
                </select>
                <input class="input" type="text" placeholder="Heading" bind:value={subfield.label} slot="label" {disabled}>
                <input class="input" type="text" placeholder="main-heading" bind:value={subfield.key} slot="key" {disabled}>
              </EditField>
            {/each}
          {/if}
          <button class="field-button subfield-button" on:click={() => addSubField(field.id)} {disabled}><i class="fas fa-plus mr-2"></i>Create Subfield</button>
        {:else if field.type === 'repeater'}
          {#if field.fields}
            {#each field.fields as subfield}
              <EditField fieldTypes={subFieldTypes} on:delete={() => deleteSubfield(field.id, subfield.id)} {disabled}>
                <select bind:value={subfield.type} slot="type" {disabled}>
                  {#each subFieldTypes as field}
                    <option value={field.id}>{ field.label }</option>
                  {/each}
                </select>
                <input class="input" type="text" placeholder="Heading" bind:value={subfield.label} slot="label" {disabled}>
                <input class="input" type="text" placeholder="main-heading" bind:value={subfield.key} slot="key" {disabled}>
              </EditField>
            {/each}
          {/if}
          <button class="field-button subfield-button" on:click={() => addSubField(field.id)} {disabled}><i class="fas fa-plus mr-2"></i>Create Subfield</button>
        {:else if field.type === 'message'}
          <textarea {disabled} rows="3" bind:value={field.value} class="w-full border border-solid border-gray-200 rounded"></textarea>
        {/if}
      </Card>
    {/each}
    <button class="field-button" on:click={addField} {disabled}><i class="fas fa-plus mr-2"></i>Add a Field</button>
  {:else}
    {#each fields as field}
      <div class="field-item" id="field-{field.key}">
        <svelte:component this={_.find($fieldTypes, ['id', field.type]).component} {field} on:input={() => updateHtmlWithFieldData('static')} />
      </div>
    {:else}
      <p class="text-center h-full flex items-start p-24 justify-center text-lg text-gray-700 mt-3 bg-gray-100">
        {#if $userRole === 'developer'}
          You'll need to create and integrate a field before you can edit content from here
        {:else}
          The site developer will need to create and integrate a field before you can edit content from here
        {/if}
      </p>
    {/each}
  {/if}
</div>

<div class="flex flex-row justify-end mt-4">
  <SaveButton on:click={applyFields}>Save</SaveButton>
</div>

<style>
  input, select {
    @apply outline-none;
  }
  .field-button {
    @apply w-full bg-gray-800 text-gray-300 py-2 rounded font-medium transition-colors duration-200;
    &:hover {
      @apply bg-gray-900;
    }
    &[disabled] {
      @apply bg-gray-500 cursor-not-allowed;
    }
  }
  .field-button.subfield-button {
    width: calc(100% - 1rem);
    @apply ml-4 text-sm py-1 mb-2 mt-2 bg-gray-100 text-gray-700 transition-colors duration-100 outline-none;
    &:hover {
      @apply bg-gray-300;
    }
    &:focus {
      @apply bg-gray-200;
    }
  }
</style>