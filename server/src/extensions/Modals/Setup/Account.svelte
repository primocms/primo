<script context="module">
  import {writable} from 'svelte/store'
  export const user = writable(null)
</script>

<script>
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()
  import {fade} from 'svelte/transition'
  import axios from 'axios'
  import {TextField,PrimaryButton,Spinner} from '@primo-app/ui'

  async function createAccount() {
    loading = true
    setTimeout(() => {
      user.set({ email, password })
      dispatch('click')
    }, 1000);
  }

  let email = ''
  let password = ''
  $: disabled = !email || !password
  
  let loading = false
</script>

<main in:fade>
  
  <form on:submit|preventDefault={createAccount}>
    <TextField autofocus label="Email Address" bind:value={email} placeholder="firstlast@gmail.com" variants="my-4" />
    <TextField label="Password" type="password" bind:value={password} placeholder="hunter2" variants="mb-4" />
    <div class="text-sm text-gray-700 p-4 bg-gray-100 mb-6">
      This is the account you'll use to administrate this primo server. Make sure you don't lose access to this email address or you'll lose your server too.
    </div>
    <PrimaryButton type="submit" {disabled} {loading}>Create Account</PrimaryButton>
  </form>
</main>