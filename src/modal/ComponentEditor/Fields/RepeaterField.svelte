<script>
  import pluralize from 'pluralize'
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher() 

  import {getUniqueId} from '../../../utils'
  import {Card} from '../../../components/misc'
  import {ContentField, EditField, GenericField, ImageField} from '../../../components/inputs'
  import RepeaterField from '../RepeaterField.svelte'

  export let field

  function addRepeaterItem() {
    const keys = field.fields.map(f => f.key)
    field.value = [
      ...field.value,
      keys.reduce((a,b) => (a[b]='',a), { id: getUniqueId() }) // turn keys into value object
    ]
    dispatch('input')
  }

  function removeRepeaterItem(itemId) {
    field.value = field.value.filter(item => item.id !== itemId)
    dispatch('input')
  }

  function moveRepeaterItem(item, direction) {
    const indexOfItem = _.findIndex(field.value, ['id', item.id])
    const withoutItem = field.value.filter(i => i.id !== item.id)
    if (direction === 'up') {
      field.value = [...withoutItem.slice(0,indexOfItem-1), item, ...withoutItem.slice(indexOfItem-1)];
    } else {
      field.value = [...withoutItem.slice(0, indexOfItem+1), item, ...withoutItem.slice(indexOfItem+1)];
    }
  }
</script>

<Card variants="p-2 pb-4">
  <header>{field.label}</header>
  {#each field.value as item (item.id)} 
    <RepeaterField 
      {field} 
      on:delete={() => removeRepeaterItem(item.id)}
      on:move={({detail:direction}) => moveRepeaterItem(item, direction)}
      let:subfield
    >
      <label slot="text">
        <span class="text-xs font-bold">{subfield.label}</span>
        <input class="bg-white border border-gray-300 rounded p-2 mb-2 block w-full appearance-none leading-normal" type={subfield.type} value={item[subfield.key]||''} on:input={({target}) => { item[subfield.key] = target.value; dispatch('input')}}>
      </label> 
      <label slot="checkbox">
        <span class="text-xs font-bold">{subfield.label}</span>
        <input type="checkbox" bind:checked={item[subfield.key]} on:input>
      </label>
      <label slot="content">
        <span class="text-xs font-bold">{subfield.label}</span>
        <textarea class="textarea is-medium" bind:value={item[subfield.key]} on:input></textarea>
      </label>
      <div slot="image">
        <ImageField 
          field={{
            value: item[subfield.key]
          }}
          on:input={({detail:url}) => {
            item[subfield.key] = url
            dispatch('input')
          }}
        />
      </div>
    </RepeaterField>
  {/each}
</Card>
<button class="field-button" on:click={() => addRepeaterItem(field)}>Add {pluralize.singular(field.label)}</button>


<style>
  .field-button {
    @apply w-full bg-gray-800 text-gray-300 py-2 rounded font-medium transition-colors duration-200;
    &:hover {
      @apply bg-gray-900;
    }
    &[disabled] {
      @apply bg-gray-500 cursor-not-allowed;
    }
  }
</style>