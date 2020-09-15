<script>
  import {find} from 'lodash'
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher() 

  import fieldTypes from '../../stores/app/fieldTypes'
  import {Card} from '../misc'
  import ContentField from './ContentField.svelte'
  import {EditField, GenericField, ImageField} from '../inputs'

  export let field

</script>

<Card title={field.label} variants="p-2">
  {#each field.fields as subfield}
    <svelte:component this={find($fieldTypes, ['id', subfield.type]).component} field={subfield} on:input />
  {/each}
</Card>