<script>
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher() 

  import {Card} from '../misc'
  import ContentField from './ContentField.svelte'
  import {EditField, GenericField, ImageField} from '../inputs'

  export let field

</script>

<Card title={field.label} variants="p-2">
  {#each field.fields as subfield}
    {#if subfield.type === 'image'}
      <Card title={subfield.label} image={subfield.value} variants="px-2 pb-2">
        <ImageField 
          imageUrl={subfield.value}  
          on:submit={({detail}) => {
            subfield.value = detail.url;
            dispatch('input')
          }} 
        />
      </Card>
    {:else if subfield.type === 'content'}
      <div class="field">
        <label class="label" for={subfield.id}>
          { subfield.label }
          <textarea id={subfield.id} class="textarea is-medium" bind:value={subfield.value} on:input></textarea>
        </label>
      </div>
    {:else}
      <ContentField horizontal={true} field={subfield} on:input />              
    {/if}
  {/each}
</Card>