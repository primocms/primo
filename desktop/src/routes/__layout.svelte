<script>
  import { browser } from '$app/env'
  import {setContext} from 'svelte'
  import ImageField from '../extensions/FieldTypes/ImageField.svelte'
  import SiteButtons from '$lib/components/SiteButtons.svelte'
  import {
    dropdown,
    registerProcessors,
    fieldTypes
  } from '@primo-app/primo'
  import * as primo from '@primo-app/primo/package.json'
  import * as desktop from '../../package.json'
  import {track} from '$lib/actions'

  if (browser) {
    import('../compiler/processors').then(({ html, css }) => {
      registerProcessors({ html, css })
    })
    fieldTypes.register([
      {
        id: 'image',
        label: 'Image',
        component: ImageField,
      }
    ])
    dropdown.set([
      {
        label: 'Back to Dashboard',
        icon: 'fas fa-arrow-left',
        href: '/',
      },
      {
        component: SiteButtons,
      },
    ])
    setContext('track', track)
  }

</script>

<div id="primo-desktop-toolbar" />
<slot />
<div id="app-version">
  <span>Primo Desktop v{desktop.version}</span>
  <span>Editor v{primo.version}</span>
  <button id="primo-update-button" on:click={() => {
    window.primo.checkForUpdate()
  }}>Check for Update</button>
</div>

<style global lang="postcss">
  .primo-reset {
    font-family: 'Satoshi', sans-serif !important;
  }

	#primo-modal {
		top: 28px !important;
	}

  #primo-desktop-toolbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 30px;
    -webkit-app-region: drag;
    border-bottom: 1px solid #222;
    background: var(--primo-color-black);
    z-index: 1;
  }

  #primo-toolbar-overlay > div {
    padding-left: 5rem !important;
  }

  #app-version {
    font-family: 'Satoshi', sans-serif;
    font-size: 0.75rem;
    color: var(--color-gray-4);
    position: fixed;
    bottom: 0.5rem;
    left: 0.5rem;
  }

  #app-version button {
    color: var(--color-gray-4);
    font-size: 0.75rem;
    font-family: 'Satoshi', sans-serif;
    background: transparent;
    border: 0;
    text-decoration: underline;
  }

  #app-version span:first-child {
    margin-right: 0.5rem;
  }

  .primo-reset {
    @tailwind base;
    font-family: 'Satoshi', sans-serif !important;
    direction: ltr;
    user-select: none;

    .primo-modal {
    color: var(--color-gray-1);
    background: var(--color-gray-9);
    padding: 2rem;
    border-radius: var(--primo-border-radius);
    margin: 0 auto;
    width: 100vw;
  }

  .primo-heading-xl {
    margin-bottom: 0.5rem;
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 700;
  }

  .primo-heading-lg {
    margin-bottom: 0.5rem;
    font-size: 1.1rem;
    line-height: 1.5rem;
    font-weight: 700;
  }
}

body {
  --primo-color-primored: rgb(248, 68, 73);
  --primo-color-primored-dark: rgb(186, 37, 42);
  --primo-color-white: white;
  --primo-color-codeblack: rgb(30, 30, 30);
  --primo-color-codeblack-opaque: rgba(30, 30, 30, 0.9);

  --primo-color-black: rgb(17, 17, 17);
  --primo-color-black-opaque: rgba(17, 17, 17, 0.9);

  --color-gray-1: rgb(245, 245, 245);
  --color-gray-2: rgb(229, 229, 229);
  --color-gray-3: rgb(212, 212, 212);
  --color-gray-4: rgb(156, 163, 175);
  --color-gray-5: rgb(115, 115, 115);
  --color-gray-6: rgb(82, 82, 82);
  --color-gray-7: rgb(64, 64, 64);
  --color-gray-8: rgb(38, 38, 38);
  --color-gray-9: rgb(23, 23, 23);

  --font-size-1: 0.75rem;
  --font-size-2: 0.875rem;
  --font-size-3: 1.125rem;
  --font-size-4: 1.25rem;

  box-shadow: 0 0 #0000 0 0 #0000, 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --box-shadow-xl: 0 0 #0000, 0 0 #0000, 0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);

  --transition-colors: background-color 0.1s, border-color 0.1s, color 0.1s,
    fill 0.1s, stroke 0.1s;

  --padding-container: 15px;
  --max-width-container: 1900px;

  --ring: 0px 0px 0px 2px var(--primo-color-primored);

  --primo-max-width-1: 30rem;
  --primo-max-width-2: 1200px;
  --primo-max-width-max: 1200px;

  --primo-ring-primored: 0px 0px 0px 2px var(--primo-color-primored);
  --primo-ring-primored-thin: 0px 0px 0px 1px var(--primo-color-primored);
  --primo-ring-primored-thick: 0px 0px 0px 3px var(--primo-color-primored);

  --primo-border-radius: 5px;
}

button,
a {
  cursor: pointer;
}

body {
  margin: 0;
}

.primo-input {
appearance: none;
border: 0;
background-color: transparent;
font-size: inherit;
background: var(--color-white);
padding: 0.5rem 0.75rem;
width: 100%;

/* &:focus {
  box-shadow: 0 0 0 1px var(--color-primored);
  border: 0;
}

&:placeholder {
  color: var(--color-gray-5);
} */
}

.sr-only {
position: absolute;
width: 1px;
height: 1px;
padding: 0;
margin: -1px;
overflow: hidden;
clip: rect(0, 0, 0, 0);
white-space: nowrap;
border-width: 0;
}

button {
  &:disabled {
    opacity: 0.5;
    pointer-events: none;
  } 
}

</style>
