<script>
  import { setContext } from 'svelte'
  import '$lib/assets/reset.css'
  import { browser } from '$app/environment'
  import { goto } from '$app/navigation'
  import { mouse_position } from '$lib/stores'
  import { onMount } from 'svelte'
  import {
    modal as primoModal,
    fieldTypes,
    registerProcessors,
    dropdown,
    stores,
  } from '$lib/editor'
  import user from '../stores/user'
  import { config } from '../stores'
  import { supabase as supabaseClient } from '$lib/supabase'
  import { watchForAutoLogin } from '../supabase/auth'
  import { users } from '../supabase/db'
  import Modal, { show, hide } from '$lib/components/Modal.svelte'
  import Build from '../extensions/Build.svelte'
  import ImageField from '../extensions/FieldTypes/ImageField.svelte'
  import SiteButtons from '$lib/components/SiteButtons.svelte'
  import { invalidate } from '$app/navigation'

  export let data

  const { saved } = stores

  onMount(() => {
    const { data } = supabaseClient.auth.onAuthStateChange(() => {
      invalidate('supabase:auth')
    })

    return () => {
      if (data) data.subscription.unsubscribe()
    }
  })

  if (data.session) {
    user.update((u) => ({
      ...u,
      ...data.session.user,
      signedIn: true,
    }))
  }

  if (browser) {
    import('../compiler/processors').then(({ html, css }) => {
      registerProcessors({ html, css })
    })
    primoModal.register([
      {
        id: 'BUILD',
        component: Build,
        componentProps: {
          siteName: 'Website', // TODO - change
        },
        options: {
          route: 'build',
          width: 'md',
          header: {
            title: 'Build to Github',
            icon: 'fab fa-github',
          },
          hideLocaleSelector: true,
        },
      },
    ])
    fieldTypes.register([
      {
        id: 'image',
        label: 'Image',
        component: ImageField,
      },
    ])
    dropdown.set([
      {
        label: 'Back to Dashboard',
        icon: 'fas fa-arrow-left',
        href: '/',
        onClick: (e) => {
          if (!$saved) {
            e.preventDefault()
            window.alert(
              `Save your site before navigating away so you don't lose your changes`
            )
          }
        },
      },
      {
        component: SiteButtons,
      },
    ])
    setContext('track', () => {})
  }

  // watchForAutoLogin(async (event, session) => {
  //   if (event === 'SIGNED_IN') {
  //     const { id, email } = session.user
  //     const [userData] = await users.get(null, 'role, sites', email)
  //     if (!userData) return
  //     user.update((u) => ({
  //       ...u,
  //       uid: id,
  //       id,
  //       email,
  //       signedIn: true,
  //       admin: userData.role === 'admin',
  //       role: userData.role === 'admin' ? 'developer' : userData.role,
  //       sites: userData.sites,
  //     }))
  //   } else if (event === 'SIGNED_OUT') {
  //     user.reset()
  //     goto('/')
  //   } else if (event === 'PASSWORD_RECOVERY') {
  //     // passwordResetToken = session.access_token;
  //   } else {
  //     console.warn('NEW AUTH EVENT', event)
  //   }
  // })
</script>

<svelte:window
  on:mousemove={(event) => {
    $mouse_position = { x: event.x, y: event.y }
  }}
/>

<div style:--primo-color-brand={$config.customization.color}>
  <Modal />
  <slot />
</div>

<style global>
  .primo-reset {
    @tailwind base;
    font-family: 'Satoshi', sans-serif !important;
    direction: ltr;

    /* height: 100vh; */
    /* overflow: hidden; */

    --primo-color-brand: #35d994;
    --primo-color-brand-dark: #097548;
    --primo-color-white: white;
    --primo-color-codeblack: rgb(30, 30, 30);
    --primo-color-codeblack-opaque: rgba(30, 30, 30, 0.9);

    --primo-color-black: rgb(17, 17, 17);
    --primo-color-black-opaque: rgba(17, 17, 17, 0.95);

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

    --box-shadow-xl: 0 0 #0000, 0 0 #0000, 0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);

    --transition-colors: background-color 0.1s, border-color 0.1s, color 0.1s,
      fill 0.1s, stroke 0.1s;

    --padding-container: 15px;
    --max-width-container: 1900px;

    --ring: 0px 0px 0px 2px var(--primo-color-brand);

    --primo-max-width-1: 30rem;
    --primo-max-width-2: 1200px;
    --primo-max-width-max: 1200px;

    --primo-border-radius: 5px;
    --primo-ring-brand: 0px 0px 0px 2px var(--primo-color-brand);
    --primo-ring-brand-thin: 0px 0px 0px 1px var(--primo-color-brand);
    --primo-ring-brand-thick: 0px 0px 0px 3px var(--primo-color-brand);
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

  .primo-modal {
    color: var(--color-gray-1);
    /* background: var(--color-gray-9); */
    padding: 1rem;
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
    margin-bottom: 0.25rem;
    font-size: 1.1rem;
    line-height: 1.5rem;
    font-weight: 700;
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
</style>
