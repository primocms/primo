<script>
  import Editor from './Editor.svelte';
  import { unsaved } from '../../stores/app/misc';
  import site from '../../stores/data/site';

  function savePage() {
    $unsaved = false;
    site.save();
  }

</script>

<Editor on:change on:save={savePage} on:build on:signOut />
