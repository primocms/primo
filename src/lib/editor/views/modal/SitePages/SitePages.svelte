<script lang="ts">
  import ModalHeader from '../ModalHeader.svelte'
  import PageList from './PageList/PageList.svelte'
</script>

<ModalHeader icon="fas fa-th-large" title="Pages" />

<main>
  <PageList />
</main>

<style lang="postcss">
  main {
    padding: 0.5rem 1rem;
    background: var(--primo-color-black);
    overflow-y: scroll;
  }
</style>
