<script>
  import { unsaved } from '../../stores/app/misc';
  import { goto } from '$app/navigation';
  export let button;

  function warn() {
    if ($unsaved) {
      window.alert(
        `Save your site before navigating away so you don't lose your changes`
      );
    } else {
      if (button.onClick) button.onClick();
      goto(button.href);
    }
  }

</script>

<button on:click={warn} href={button.href} id={button.id}>
  <i class="{button.icon} mr-1" />
  <span>{button.label}</span>
</button>

<style lang="postcss">
  button {
    background: var(--primo-color-codeblack) !important;
    box-shadow: var(--ring) !important;
    color: var(--color-gray-1) !important;
    font-size: var(--font-size-1) !important;
    display: block !important;
    padding: 0.5rem 1rem !important;
    margin-bottom: 0.5rem !important;
    border-radius: var(--primo-border-radius) !important;
    width: 100% !important;
    text-align: center !important;
    &:not(:last-child) {
      margin-bottom: 0.75rem !important;
    }
    &:hover {
      background: var(--primo-color-primored) !important;
    }
  }

  i {
    margin-right: 5px;
  }

</style>
