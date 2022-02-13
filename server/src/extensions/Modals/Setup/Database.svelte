<script>
  import axios from 'axios'
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher();
  import {TextField,PrimaryButton} from '@primo-app/ui'
  import {fade} from 'svelte/transition'
  import {user} from './Account.svelte'

  async function connectDB() {
    error = false
    loading = true
    const {data:res} = await axios.post('http://localhost:3005/__fn/setup/db', {uri})

    if (res.success) {
      await axios.post('http://localhost:3005/__fn/auth/create', $user)
      dispatch('click')
    } else {
      error = true
    }
    loading = false

  }
  
  let uri = ''
  let loading = false
  let error = false
</script>

<main in:fade>
  <div class="content">
    <p class="mb-2">primo uses MongoDB Atlas to store your website's data. Its free tier should be more than enough for all your sites, and once you connect it, you won't have to think about it again.</p>
    <div>
      Follow these instructions to get your database's URI (don't worry about your credentials, they'll be stored in a Heroku environment variable): 
      <ol class="list-decimal list-inside mt-2">
        <li>Sign up for a <a href="https://account.mongodb.com/account/register?signedOut=true" target="blank">MongoDB cloud account</a> (you can skip the account set-up)</li>
        <li>On the Cluster selection page ("Choose a path. Adjust anytime.") select <strong>Shared Clusters</strong></li>
        <li>Select any provider/region and click 'Create Cluster'</li>
        <ol class="list-decimal list-inside ml-3 my-1">
          <li>Allow Access from Anywhere</li>
          <li>Save 0.0.0.0 IP Address</li>
          <li>Create a Database User (remember your password)</li>
        </ol>
        <li><strong>Connect your application</strong></li>
        <li>Ensure the <strong>Node.js</strong> driver is selected</li>
        <li>Copy the connection string</li>
      </ol>
    </div>
  </div>
  <form on:submit|preventDefault={connectDB}>
    <TextField autofocus label="Database URI" size="small" type="url" bind:value={uri} placeholder="mongodb+srv://johndoe:hunter2@cluster0.jjwkj.mongodb.net" variants="mb-4" />
    <div class="text-xs text-gray-700 mb-4">
      The connection string should look like this: <pre class="p-2 bg-gray-100 overflow-scroll">mongodb+srv://<strong>username</strong>:<strong>password</strong>@<strong>cluster</strong>.<strong>region</strong>.mongodb.net</pre>
    </div>
    {#if error}
      <div class="text-sm text-gray-700 p-4 bg-yellow-300 mb-4">
        Could not connect to database. Ensure the connection string ends with <strong>mongodb.net</strong> and that your Cluster is publicly accessible.
      </div>
    {/if}
    <PrimaryButton {loading} type="submit">Connect Database</PrimaryButton>
  </form>
</main>

<style>
  .content {
    @apply text-sm text-gray-700 p-4 bg-gray-100 mb-4;
  }
  .content ol {@apply list-decimal list-inside;}
  .content a {@apply underline text-blue-500;}
</style>