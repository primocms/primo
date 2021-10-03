<script>
  import Editor from './Editor.svelte';
  import site from '../../stores/data/site';
</script>

<Editor on:change on:save on:build on:signOut />
