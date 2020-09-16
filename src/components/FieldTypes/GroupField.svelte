<script>
  import {find} from 'lodash'
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher() 

  import fieldTypes from '../../stores/app/fieldTypes'
  import {Card} from '../misc'

  export let field

</script>

<Card title={field.label} variants="p-2">
  {#each field.fields as subfield}
    <svelte:component this={find($fieldTypes, ['id', subfield.type]).component} field={subfield} on:input />
  {/each}
</Card>