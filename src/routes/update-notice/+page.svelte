<script>
  import { page } from '$app/stores'

  const alert = $page.url.searchParams.get('alert')
</script>

<link
  rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css"
/>

<div class="alert" data-theme="dark">
  <div class="container">
    {#if alert === 'missing-symbol-index'}
      <div class="headings">
        <h1>Your database needs a quick change</h1>
        <h2>
          A recent update to Primo added the ability to rearrance Blocks in the
          sidebar, but it requires a small change to your database to work
          correctly. This is a one-time change and will not affect your existing
          data.
        </h2>
      </div>

      <h3>Here's what you need to do:</h3>
      <ol>
        <li>
          <strong>Open your Supabase SQL Editor:</strong>
          <span />
          You'll need to run the SQL command in the next step. If you're not sure
          how to access the SQL Editor, refer to the
          <a
            href="https://supabase.com/docs/guides/database/overview#the-sql-editor"
            target="blank"
          >
            Supabase documentation.
          </a>
        </li>
        <li>
          <strong>Run the following query:</strong>
          <span>
            Copy and paste the below SQL code into the editor and execute it. It
            should return "Success. No rows returned"
          </span>
        </li>
        <pre>alter table symbols<br />add column index integer;</pre>
        <li>
          <strong>Refresh this page:</strong>
          <span>
            Once the query has been successfully executed, refresh this page to
            apply the changes. If all went well, you'll be redirected to your
            Primo dashboard.
          </span>
        </li>
      </ol>
    {/if}
    <footer>
      See the <a target="blank" href="https://primocms.org/changelog">
        release notes
      </a>
      for more info or get help in the
      <a target="blank" href="https://discord.gg/RmjYqDq">Primo Discord</a>
    </footer>
  </div>
</div>

<style lang="postcss">
  h1 {
    line-height: 1.1;
    margin-bottom: 0.5rem;
  }
  h3 {
    --typography-spacing-vertical: 1rem;
  }
  .alert {
    font-size: 1.25rem;
    position: fixed;
    inset: 0;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #111;
    color: white;
    font-family: system-ui, sans-serif;

    .container {
      max-width: 900px;
      background: #222;
      padding: 2rem;
      border-radius: 0.25rem;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
  }
  pre {
    padding: 0.25rem 0.5rem;
    border: 1px solid #35d994;
    display: inline-block;
  }
  a {
    color: #35d994;
  }
  footer {
    font-size: 1rem;
  }
</style>
