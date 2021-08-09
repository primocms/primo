<script>
  import { unsaved } from '../../stores/app/misc';
  import { router } from 'tinro';
  export let button;

  function warn() {
    if ($unsaved) {
      window.alert(
        `Save your site before navigating away so you don't lose your changes`
      );
    } else {
      button.onClick();
      router.goto(button.href);
    }
  }

</script>

<button on:click={warn} href={button.href} id={button.id}>
  <i class="{button.icon} mr-1" />
  <span>{button.label}</span>
</button>

<style lang="postcss">
  button {
    background: var(--color-codeblack);
    box-shadow: var(--ring);
    color: var(--color-gray-1);
    font-size: var(--font-size-1);
    display: block;
    padding: 0.5rem 1rem;
    margin-bottom: 0.5rem;
    border-radius: var(--border-radius-1);
    width: 100%;
    text-align: center;
    &:not(:last-child) {
      margin-bottom: 0.75rem;
    }
    &:hover {
      background: var(--color-primored);
    }
  }

  i {
    margin-right: 5px;
  }

</style>
