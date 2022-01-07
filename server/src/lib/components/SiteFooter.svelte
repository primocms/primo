<script>
  import * as primo from '@primo-app/primo/package.json'

  const date = new Date()
  const month = date.toLocaleString('default', { month: 'long' })
</script>

<footer class="container">
  <span class="disclaimer">
    <span>primo v{primo.version}</span>
    <span>server v{__SERVER_VERSION__}</span>
  </span>
  <div class="footer-links">
    <div>
      <a href="https://discord.gg/vzSFTS9" rel="external" target="blank"
        >Community</a
      >
      |
      <a
        href="https://primo.af/terms-of-service"
        title="Terms and Conditions"
        rel="external"
        target="blank">Terms</a
      >
      |
      <a
        href="https://primo.af/privacy-policy"
        title="Privacy Policy"
        rel="external"
        target="blank">Privacy</a
      >
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
