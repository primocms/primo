<script>
  // import * as primo from '$lib/editor/package.json'
  import { config } from '../../stores'

  const date = new Date()
  const month = date.toLocaleString('default', { month: 'long' })
</script>

<footer class="container">
  <span class="disclaimer">
    <!-- <span>primo v{primo.version}</span> -->
    <!-- <span>server v{__SERVER_VERSION__}</span> -->
  </span>
  <div class="footer-links">
    <div>
      {#each $config.customization.links as link}
        <a href={link.url} rel="external" target="blank">{link.label}</a>
      {/each}
    </div>
    <span class="copyright primo">©</span>
  </div>
</footer>

<style lang="postcss">
  footer {
    font-size: var(--font-size-1);
    color: var(--color-gray-3);
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 1rem 0;
    margin-top: auto;
  }

  a {
    color: var(--color-gray-3);
    transition: color 0.2s;
    &:hover {
      color: var(--color-white);
    }
  }

  .footer-links {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }

  .footer-links a {
    margin: 0 0.5rem;
  }

  .footer-links a:first-child {
    margin-left: 0;
  }

  .disclaimer {
    display: block;
  }

  .primo {
    font-weight: 800;
    color: var(--color-primored);
  }
</style>
