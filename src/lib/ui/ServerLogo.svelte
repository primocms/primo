<script>
  import logo from '$lib/assets/server-logo.svg'
  import { browser } from '$app/environment'
  import { storage } from '$lib/services'

  let image_url = logo
  if (browser) {
    storage
      .download({ bucket: 'images', key: `server-logo.svg` })
      .then((res) => {
        if (res) {
          image_url = res
        }
      })
  }
</script>

<div class="logo">
  <!-- svelte-ignore a11y-missing-attribute -->
  <img src={image_url} />
</div>

<style>
  .logo {
    width: 100%;
  }
  img {
    width: 100%;
  }
</style>
