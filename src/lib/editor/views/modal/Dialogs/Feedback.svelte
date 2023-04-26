<script>
  import axios from 'axios'
  import {getContext} from 'svelte'
  import PrimaryButton from '../../../components/buttons/PrimaryButton.svelte'

  let form

  let submitted = false
  let successful = false

  let version
  if (getContext('ENVIRONMENT') === 'DESKTOP') {
    version = `Desktop: ${__DESKTOP_VERSION__}`
  } else if (getContext('ENVIRONMENT') === 'SERVER') {
    version = `Server: ${__SERVER_VERSION__}`
  } else if (getContext('ENVIRONMENT') === 'TRY') {
    version = `Try Primo: ${__TRY_VERSION__}`
  }

</script>

{#if !submitted}
  <main>
    <h1>Feedback</h1>
    <p>Let us know if something broke, if there's something you want to do that you can't do (yet), or even if you're just enjoying primo.</p>
    <form bind:this={form} on:submit|preventDefault={() => {
      var data = new window.FormData(form);
      axios.post('https://formspree.io/f/xknywogb', data).then(res => {
        console.log({res})
        if (res.data?.ok) {
          successful = true
        }
      })
      .finally(() => {
        submitted = true
      })
    }}>
      <label>
        <span>Message *</span>
        <textarea required name="message"></textarea>
      </label>
      <label>
        <span>Email address (if you'd like us to follow up)</span>
        <input type="email" class="primo-input" name="email">
      </label>
      <div class="hidden">
        <input type="platform" class="primo-input" name="platform" value="{window.navigator}">
        <input type="version" class="primo-input" name="version" value="{version}  Primo: ___">
      </div>
      <PrimaryButton type="submit">Submit</PrimaryButton>
    </form>
  </main>
{:else if submitted && successful}
  <main>
    <h1>Feedback Submitted Successfully</h1>
    <p>Thanks for your message! If you provided your email address, we'll try to follow up with you as soon as possible.</p>
  </main>
{:else if submitted && !successful}
  <main>
    <h1>Unsuccessful</h1>
    <p>For some reason we weren't able to submit your feedback. Please let us know by emailing contact@primo.af</p>
  </main>
{/if}

<style lang="postcss">

  .hidden {
    display: none;
  }

  main {
    padding: 2rem;
    margin: auto;
  }

  h1 {
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.5;
  }

  form {
    display: grid;
    gap: 1rem;
    padding-top: 2rem;

    span {
      padding-bottom: 0.5rem;
      display: block;
    }

    input {
      padding: 0.5rem;
      background: var(--color-gray-9);

      &:focus {
        outline: 0;
      }
    }

    textarea {
      width: 100%;
      padding: 0.5rem;
      background: var(--color-gray-9);

      &:focus {
        outline: 0;
      }
    }
  }
</style>