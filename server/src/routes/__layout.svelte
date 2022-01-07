<script>
  import '$lib/assets/reset.css'
  import { browser } from '$app/env'
  import { goto } from '$app/navigation'
  import { registerProcessors, dropdown } from '@primo-app/primo'
  import user from '../stores/user'
  import { watchForAutoLogin, signOut } from '../supabase/auth'
  import Modal, { show, hide } from '$lib/components/Modal.svelte'
  import * as actions from '../actions'
  import SiteButtons from '$lib/components/SiteButtons.svelte'

  if (browser) {
    import('../compiler/processors').then(({ html, css }) => {
      registerProcessors({ html, css })
    })
  }

  watchForAutoLogin(async (event, session) => {
    if (event === 'SIGNED_IN') {
      const { id, email } = session.user
      user.update((u) => ({
        ...u,
        uid: id,
        id,
        // username: username || id,
        email,
        signedIn: true,
      }))
    } else if (event === 'SIGNED_OUT') {
      user.reset()
      goto('/')
    } else if (event === 'PASSWORD_RECOVERY') {
      // passwordResetToken = session.access_token;
    } else {
      console.warn('NEW AUTH EVENT', event)
    }
  })

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

  $: if (!$user.signedIn) {
    show({
      id: 'AUTH',
      options: {
        disableClose: true,
      },
      props: {
        onSignIn: () => {
          hide()
          actions.sites.initialize()
          actions.hosts.initialize()
        },
      },
    })
  }
</script>

<Modal />
<slot />
