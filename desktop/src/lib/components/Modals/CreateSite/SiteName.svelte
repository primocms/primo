<script>
  import {createEventDispatcher} from 'svelte'
  import {find as _find} from 'lodash-es'
  import { _ as C } from 'svelte-i18n'
  import TextField from '$lib/ui/TextField.svelte'
  import { makeValidUrl } from '$lib/utils'
  import Button from '@primo-app/primo/components/buttons/Button.svelte'

  const dispatch = createEventDispatcher();

  let name = ``
  let id = ``
  let siteIDFocused = false

  function validateUrl() {
    id = makeValidUrl(siteIDFocused ? id : name)
    dispatch('submit', { name, id })
  }

  $: disabled = !name || !id

</script>

<h1 class="primo-heading-lg">{$C('dashboard.create.heading')}</h1>
<div class="name-url">
  <TextField
    autofocus={true}
    label="Site Name"
    on:input={validateUrl}
    bind:value={name}
  />
  <TextField
    label="Site ID"
    bind:value={id}
    on:input={validateUrl}
    on:focus={() => (siteIDFocused = true)}
  />
</div>
<footer>
  <Button label="Duplicate Site" on:click={() => dispatch('next', 'duplicate')} {disabled} variant="secondary" />
  <Button label="Select Theme" on:click={() => dispatch('next', 'themes')} {disabled} />
</footer>

<style lang="postcss">
  header {

  }

  .name-url {
    display: grid;
    gap: 0.5rem;
  }

  footer {
    display: flex;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }
</style>