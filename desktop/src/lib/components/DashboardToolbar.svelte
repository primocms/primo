<script>
  import Logo from '$lib/ui/PrimoLogo.svelte'
  import { _ as C } from 'svelte-i18n'
  import Icon from '@iconify/svelte'
  import { show } from '$lib/components/Modal.svelte'
</script>

<header role="navigation" aria-label="main navigation">
  <div class="logo">
    <Logo />
  </div>
  <nav>
    <a class="link" href="https://docs.primo.so" target="blank">
      <span>{$C('dashboard.toolbar.docs')}</span>
      <Icon icon="fa:external-link" width="0.5rem" />
    </a>
    <button on:click={() => show('USER_SETTINGS')}>{$C('dashboard.toolbar.settings')}</button>
  </nav>
</header>

<style lang="postcss">
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--color-gray-3);
    margin-bottom: 1rem;

    .logo {
      width: 8rem;
    }

    .link {
      border-bottom: 2px solid transparent;
      display: flex;
      align-items: center;
      
      span {
        margin-right: 0.5rem;
      }

      &:hover {
        border-color: var(--primo-color-brand);
      }
    }

    nav {
      display: flex;
      align-items: center;

      .link {
        margin-right: 1rem;
      }
    }
  }

  button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-gray-7);
    border-radius: var(--primo-border-radius);

    &:hover {
      box-shadow: var(--primo-ring-primogreen);
    }
  }
</style>
