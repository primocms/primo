<script>
  import { createEventDispatcher } from 'svelte'
  import Icon from '@iconify/svelte'

  const dispatch = createEventDispatcher()
  import imageCompression from 'browser-image-compression'
  import PrimaryButton from '../../../components/buttons/PrimaryButton.svelte'
  import Spinner from '../../../components/misc/Spinner.svelte'
  import { supabase } from '$lib/supabase'
  import { page } from '$app/stores'

  const defaultValue = {
    alt: '',
    url: '',
    src: '',
    size: null,
  }

  export let value = defaultValue

  console.log({ value })

  if (typeof value === 'string' || !value) {
    value = defaultValue
  }

  function setValue({ url, size }) {
    value = {
      ...value,
      url: url,
      src: url,
      size,
    }
  }

  async function encodeImageFileAsURL({ target }) {
    loading = true
    const { files } = target
    if (files.length > 0) {
      const image = files[0]

      const compressed = await imageCompression(image, {
        maxSizeMB: 0.5,
      })
      let size = new Blob([compressed]).size

      const key = `${$page.data.site.id}/${image.name + image.lastModified}`
      const { data, error } = await supabase.storage
        .from('images')
        .upload(key, compressed)

      if (data || error?.statusCode === '409') {
        const { data: res } = supabase.storage.from('images').getPublicUrl(key)

        imagePreview = res.publicUrl

        setValue({
          url: res.publicUrl,
          size: Math.round(size / 1000),
        })

        loading = false
        dispatch('input')
      } else {
        loading = false
      }
    }
  }

  let imagePreview = value.url || ''
  let loading = false
</script>

<div>
  <div class="image-info">
    {#if loading}
      <div class="spinner-container">
        <Spinner />
      </div>
    {:else}
      <div class="image-preview">
        {#if value.size}
          <span class="field-size">
            {value.size}KB
          </span>
        {/if}
        {#if value.url}
          <img src={imagePreview} alt="Preview" />
        {/if}
        <label class="image-upload">
          <Icon height="2rem" icon="uil:image-upload" />
          {#if !value.url}
            <span>Upload</span>
          {/if}
          <input
            on:change={encodeImageFileAsURL}
            type="file"
            accept="image/*"
          />
        </label>
      </div>
    {/if}
    <form on:submit|preventDefault={() => dispatch('submit', value)}>
      <div class="inputs">
        <label class="image-input">
          <span>URL</span>
          <!-- svelte-ignore a11y-autofocus -->
          <input
            autofocus
            on:input={(e) => {
              const { value } = e.target
              imagePreview = value
            }}
            bind:value={value.url}
            type="url"
          />
        </label>
        <label class="image-input">
          <span>Description</span>
          <input type="text" bind:value={value.alt} />
        </label>
      </div>
      <footer>
        <PrimaryButton type="submit" label="Add Image" />
      </footer>
    </form>
  </div>
</div>
<slot />

<style lang="postcss">
  .image-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #1a1a1a;
    padding: 0.25rem 0.75rem 0.75rem 0.75rem;

    .spinner-container {
      height: 100%;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 3rem;
    }
  }
  input {
    background: var(--color-gray-8);
  }
  .image-preview {
    width: 100%;
    padding-top: 50%;
    position: relative;
    margin-bottom: 0.25rem;

    .image-upload {
      flex: 1 1 0%;
      padding: 1rem;
      cursor: pointer;
      position: relative;
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: var(--color-gray-2);
      background: var(--color-gray-9);
      font-weight: 600;
      text-align: center;
      position: absolute;
      inset: 0;
      opacity: 0.5;
      transition: opacity, background;
      transition-duration: 0.1s;

      &:hover {
        opacity: 0.95;
      }

      span {
        margin-top: 0.25rem;
      }

      input {
        visibility: hidden;
        border: 0;
        width: 0;
        position: absolute;
      }
    }

    .field-size {
      background: var(--color-gray-8);
      color: var(--color-gray-3);
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
      padding: 0.25rem 0.5rem;
      font-size: var(--font-size-1);
      font-weight: 600;
      border-bottom-right-radius: 0.25rem;
    }

    img {
      position: absolute;
      inset: 0;
      object-fit: cover;
      height: 100%;
      width: 100%;
    }
  }

  .inputs {
    display: flex;
    flex-direction: column;
    width: 100%;

    .image-input {
      display: flex;
      align-items: center;
      font-size: var(--font-size-1);
      width: 100%;
      margin-bottom: 0.25rem;

      span {
        font-weight: 600;
        padding: 0 0.5rem;
      }

      input {
        font-size: inherit;
        flex: 1;
        padding: 0 0.25rem;
        outline: 0;
        border: 0;
      }
    }
  }

  footer {
    margin-top: 0.5rem;
  }
</style>
