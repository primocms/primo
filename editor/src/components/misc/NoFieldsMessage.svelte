<script>
  import { userRole } from '../../stores/app';
  import { EmptyState } from './';
</script>

<EmptyState>
  {#if $userRole === 'developer'}
    You'll need to create and integrate a field before you can edit
    content from here
  {:else}
    The site developer will need to create and integrate a field before
    you can edit content from here
  {/if}
</EmptyState>