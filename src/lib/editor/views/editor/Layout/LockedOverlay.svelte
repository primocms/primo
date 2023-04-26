<script>
  import { fade } from 'svelte/transition'
  import Icon from '@iconify/svelte'

  export let locked
</script>

<div class="locked-overlay primo-reset" transition:fade={{ duration: 200 }}>
  <Icon icon="carbon:locked" />
  <span>Being edited by {locked.user?.email}</span>
</div>

<style lang="postcss">
  .locked-overlay {
    color: var(--color-gray-1);
    box-shadow: inset 0 0 0 calc(4px) var(--color-gray-8);
    z-index: 999999;
    position: absolute;
    inset: 0px;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
  }
</style>
