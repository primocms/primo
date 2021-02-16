<script lang="ts">  
  import _ from 'lodash'
  import pluralize from 'pluralize'
  import {createEventDispatcher} from 'svelte'
  import {writable} from 'svelte/store'
  import {fade} from 'svelte/transition'
  const dispatch = createEventDispatcher()
  import {PrimaryButton,SaveButton} from '../../components/buttons'
  import {EditField, GenericField, ImageField} from '../../components/inputs'
  import {IconButton,Tabs} from '../../components/misc'
  import {CodeMirror} from '../../components'
  import {Card} from '../../components/misc'
  import {CodePreview} from '../../components/misc'
  import type {Subfield, Field, Fields, Component, Property, FieldType} from '../../types/components'
  import {createUniqueID} from '../../utilities'

  import ModalHeader from './ModalHeader.svelte'
  import fieldTypes from '../../stores/app/fieldTypes'
  import {switchEnabled,userRole} from '../../stores/app'
  import modal from '../../stores/app/modal'
  import {fields as pageFields} from '../../stores/app/activePage'
  import {fields as siteFields, pages} from '../../stores/data/draft'
  import {id} from '../../stores/app/activePage'
  import {hydrateComponents, symbols} from '../../stores/actions'
  import RepeaterField from '../../components/FieldTypes/RepeaterField.svelte'
  import GroupField from '../../components/FieldTypes/GroupField.svelte'

  let fields = $pageFields 

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

  function saveFields(fields) {
    if (showingPage) {
      $pageFields = fields
    } else {
      $siteFields = fields
    }
  }

  function addField(): void {
    fields = [
      ...fields,
      {
        id: createUniqueID(),
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
          id: createUniqueID(),
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
      keys.reduce((a,b) => (a[b]='',a), { id: createUniqueID() }) // turn keys into value object
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
    fields = $pageFields
  } else {
    fields = $siteFields
  }

  function applyFields() {
    hydrateComponents()
    symbols.hydrate()
    modal.hide()
  }

  function getComponent(field) {
    const fieldType =  _.find(allFieldTypes, ['id', field.type])
    if (fieldType) {
      return fieldType.component
    } else {
      return null
      console.warn(`Field type '${field.type}' no longer exists, removing '${field.label}' field`)
    }
  }

</script>

<ModalHeader 
  icon="fas fa-database"
  title={$switchEnabled ? 'Fields' : 'Content'}
  button={{
    label: `Draft`,
    icon: 'fas fa-check',
    onclick: applyFields
  }}
  variants="mb-4"
/>

<Tabs {tabs} bind:activeTab />

<div class="flex flex-col p-2 text-gray-200">
  {#if $switchEnabled}
    {#each fields as field (field.id)}
      <Card variants="field-item bg-gray-900 shadow-sm mb-2">
        <EditField on:delete={() => deleteField(field.id)} {disabled}>
          <select bind:value={field.type} slot="type" on:change={refreshFields} {disabled}>
            {#each allFieldTypes as field}
              <option value={field.id}>{ field.label }</option>
            {/each}
          </select>
          <input class="input label-input" type="text" placeholder="Heading" bind:value={field.label} slot="label" {disabled}>
          <input class="input key-input" type="text" placeholder="main-heading" bind:value={field.key} slot="key" {disabled}>
        </EditField>
        {#if field.type === 'group'}
          {#if field.fields}
            {#each field.fields as subfield}
              <EditField fieldTypes={$fieldTypes} on:delete={() => deleteSubfield(field.id, subfield.id)} {disabled}>
                <select bind:value={subfield.type} slot="type" {disabled}>
                  {#each $fieldTypes as field}
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
              <EditField fieldTypes={$fieldTypes} on:delete={() => deleteSubfield(field.id, subfield.id)} {disabled}>
                <select bind:value={subfield.type} slot="type" {disabled}>
                  {#each $fieldTypes as field}
                    <option value={field.id}>{ field.label }</option>
                  {/each}
                </select>
                <input class="input" type="text" placeholder="Heading" bind:value={subfield.label} slot="label" {disabled}>
                <input class="input" type="text" placeholder="main-heading" bind:value={subfield.key} slot="key" {disabled}>
              </EditField>
            {/each}
          {/if}
          <button class="field-button subfield-button" on:click={() => addSubField(field.id)} {disabled}><i class="fas fa-plus mr-2"></i>Create Subfield</button>
        {/if}
      </Card>
    {/each}
    <button class="field-button" on:click={addField} {disabled}><i class="fas fa-plus mr-2"></i>Add a Field</button>
  {:else}
    {#each fields as field}
      {#if getComponent(field)}
        <div class="field-item" id="field-{field.key}">
          <svelte:component this={getComponent(field)} {field} on:input={() => updateHtmlWithFieldData('static')} />
        </div>
      {/if}
    {:else}
      <p class="text-center h-full flex items-start p-24 justify-center text-lg mt-3">
        {#if $userRole === 'developer'}
          You'll need to create and integrate a field before you can edit content from here
        {:else}
          The site developer will need to create and integrate a field before you can edit content from here
        {/if}
      </p>
    {/each}
  {/if}
</div>

<style>
  .field-item {
    @apply p-4 shadow mb-2 bg-gray-900;
  }
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
    @apply rounded-sm ml-4 text-sm py-1 mb-2 mt-2 bg-gray-900 text-gray-200 transition-colors duration-100 outline-none;
    &:hover {
      @apply bg-gray-300;
    }
    &:focus {
      @apply bg-gray-200;
    }
  }
  input {
    @apply bg-gray-700 text-gray-200 p-1 rounded-sm;
    &:focus {
      @apply outline-none;
    }
  }
  select {
    @apply p-2 border-r-4 bg-gray-900 text-gray-200 border-transparent text-sm font-semibold;
  }
</style>