<script>
  import axios from 'axios'
  import modal from '../../../stores/app/modal'
  import PrimaryButton from '../../../components/buttons/PrimaryButton.svelte'

  let form

  let submitted = false
  let successful = false
</script>

<button
class="close"
on:click={modal.hide}
type="button"
xyz="small"
aria-label="Close modal"
>
<svg stroke="currentColor" fill="none" viewBox="0 0 24 24">
  <path
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="2"
    d="M6 18L18 6M6 6l12 12"
  />
</svg>
</button>

{#if !submitted}
  <main>
    <h1>Feedback</h1>
    <p>Let us know if something broke, if there's something you want to do that you can't do (yet), or even if you're just enjoying primo.</p>
    <form bind:this={form} on:submit|preventDefault={() => {
      var data = new FormData(form);
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
        <textarea autofocus required name="message"></textarea>
      </label>
      <label>
        <span>Email address (if you'd like us to follow up)</span>
        <input type="email" class="primo-input" name="email">
      </label>
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
  button.close {
    color: var(--primo-color-white);
    padding: 1rem 0.5rem;
    align-self: flex-start;

    svg {
      height: 2rem;
      width: 2rem;
    }

    &:hover {
      color: var(--primo-color-primored);
    }
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