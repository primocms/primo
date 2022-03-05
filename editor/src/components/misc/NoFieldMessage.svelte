<script>
  import { userRole } from '../../stores/app';
</script>

<p class="empty-description">
  {#if $userRole === 'developer'}
    You'll need to create and integrate a field before you can edit
    content from here
  {:else}
    The site developer will need to create and integrate a field before
    you can edit content from here
  {/if}
</p>

<style lang="postcss">
  .empty-description {
    color: var(--color-gray-4);
    font-size: var(--font-size-2);
    text-align: center;
    height: 100%;
    display: flex;
    align-items: flex-start;
    padding: 6rem;
    justify-content: center;
    margin-top: 12px;
  }
</style>