<script>
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
  import imageCompression from 'browser-image-compression'
  import svgToMiniDataURI from 'mini-svg-data-uri'

  const defaultValue = {
    alt: '',
    url: '',
    src: '',
    size: null,
  }

  export let field = {
    value: defaultValue,
  }

  if (typeof field.value === 'string' || !field.value) {
    field.value = defaultValue
  }

  function setValue({ url, size }) {
    field.value = {
      ...field.value,
      url: url,
      src: url,
      size,
    }
  }

  async function convertBlobToBase64(blob) {
    return new Promise((resolve, _) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  }

  async function encodeImageFileAsURL({ target }) {
    loading = true
    const { files } = target
    if (files.length > 0) {
      const file = files[0]

      let dataUri
      let size
      if (file.type === 'image/svg+xml') {
        const contents = await file.text()
        dataUri = svgToMiniDataURI(contents)
        size = new Blob([file]).size
      } else {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.25,
        })
        dataUri = await convertBlobToBase64(compressed)
        size = new Blob([compressed]).size
      }

      imagePreview = dataUri
      setValue({
        url: dataUri,
        size: Math.round(size / 1000),
      })

      loading = false
      dispatch('input')

      async function convertSvgToDataUri(file) {
        const reader = new FileReader()
        return new Promise((resolve, reject) => {
          reader.readAsDataURL(file)
          reader.addEventListener(
            'load',
            () => {
              resolve(reader.result)
            },
            false
          )
        })
      }
    }
  }

  async function hydratePreview() {
    // const imageKey = field.value.url.slice(12)
    // const file = await downloadSiteImage(imageKey)
    // const b64 = await convertBlobToBase64(file)
    // imagePreview = b64
  }

  let imagePreview = field.value.url || ''
  let loading = false

  $: if (imagePreview.startsWith('primo:')) hydratePreview()
</script>

<div>
  <span class="field-label">{field.label}</span>
  <div class="image-info">
    {#if loading}
      <div class="spinner-container">
        <!-- <Spinner /> -->
      </div>
    {:else}
      <div class="image-preview">
        {#if field.value.size}
          <span class="field-size">
            {field.value.size}KB
          </span>
        {/if}
        {#if field.value.url}
          <img src={imagePreview} alt="Preview" />
        {/if}
        <label class="image-upload">
          <svg
            version="1.1"
            xmlns="http://www.w3.org/2000/svg"
            xmlns:xlink="http://www.w3.org/1999/xlink"
            x="0px"
            y="0px"
            viewBox="0 0 512.056 512.056"
            style="enable-background:new 0 0 512.056 512.056;"
            xml:space="preserve"
          >
            <g>
              <g>
                <g>
                  <path
                    fill="currentColor"
                    d="M426.635,188.224C402.969,93.946,307.358,36.704,213.08,60.37C139.404,78.865,85.907,142.542,80.395,218.303
                  C28.082,226.93-7.333,276.331,1.294,328.644c7.669,46.507,47.967,80.566,95.101,80.379h80v-32h-80c-35.346,0-64-28.654-64-64
                  c0-35.346,28.654-64,64-64c8.837,0,16-7.163,16-16c-0.08-79.529,64.327-144.065,143.856-144.144
                  c68.844-0.069,128.107,48.601,141.424,116.144c1.315,6.744,6.788,11.896,13.6,12.8c43.742,6.229,74.151,46.738,67.923,90.479
                  c-5.593,39.278-39.129,68.523-78.803,68.721h-64v32h64c61.856-0.187,111.848-50.483,111.66-112.339
                  C511.899,245.194,476.655,200.443,426.635,188.224z"
                  />
                  <path
                    fill="currentColor"
                    d="M245.035,253.664l-64,64l22.56,22.56l36.8-36.64v153.44h32v-153.44l36.64,36.64l22.56-22.56l-64-64
                  C261.354,247.46,251.276,247.46,245.035,253.664z"
                  />
                </g>
              </g>
            </g>
          </svg>
          {#if !field.value.url}
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
    <div class="inputs">
      <label class="image-input">
        <span>URL</span>
        <input
          on:input={(e) => {
            const { value } = e.target
            imagePreview = value
            setValue({
              url: value,
              size: null,
            })
            dispatch('input')
          }}
          value={field.value.url}
          type="url"
        />
      </label>
      <label class="image-input">
        <span>Description</span>
        <input type="text" bind:value={field.value.alt} />
      </label>
    </div>
  </div>
</div>
<slot />

<style lang="postcss">
  .field-label {
    font-size: var(--font-size-1);
    font-weight: 600;
    display: inline-block;
    padding-bottom: 0.25rem;
  }
  .image-info {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--primo-color-primored);
    padding: 0.5rem;

    .spinner-container {
      background: var(--primo-color-primored);
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
        background: var(--primo-color-primored);
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

      svg {
        max-width: 4rem;
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
</style>
