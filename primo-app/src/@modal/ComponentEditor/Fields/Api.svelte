<!-- <div class="field is-horizontal" in:fade={{ duration: 100 }}>
  <div class="field-body">
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
</div> -->