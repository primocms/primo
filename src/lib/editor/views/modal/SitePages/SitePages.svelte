<script>
  import ModalHeader from '../ModalHeader.svelte'
  import PageList from './PageList/PageList.svelte'
</script>

<ModalHeader
  svg={`<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2.5" y="2.5" width="5" height="5" rx="0.5" fill="#CECECE" stroke="#CECECE"/><rect x="10.5" y="2.5" width="5" height="5" rx="0.5" fill="#CECECE" stroke="#CECECE"/><rect x="2.5" y="10.5" width="5" height="5" rx="0.5" fill="#CECECE" stroke="#CECECE"/><rect x="10.5" y="10.5" width="5" height="5" rx="0.5" fill="#CECECE" stroke="#CECECE"/></svg>`}
  title="Pages"
/>

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
