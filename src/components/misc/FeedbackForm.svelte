<script>
  import {user} from '../../stores/data'

  let drawerOpen = false

  let feedbackType = 'bug'
  $: feedbackLabels = {
    'bug' : ['bug','Whenever I press the "Style" button nothing happens'],
    'wish' : ['praying-hands', "I'd like to be able to choose more types of page headers"],
    'love' : ['heart', "I love all the different font combinations"],
    'other' : ['otter', "When I click the link button it calls me names"]
  }[feedbackType]

  let details = ''
  $: disableForm = details.length < 3

</script>


<div class="feedback" class:drawer-open={drawerOpen}>
  <button class="button has-tooltip-left" data-tooltip="Report a bug" aria-label="Report a bug" on:click={() => drawerOpen = !drawerOpen}>
    <span class="icon is-small">
      <i class="fas fa-{feedbackLabels[0]}"></i>
    </span>
  </button>
  <form action="https://usebasin.com/f/01497934b82f" method="POST" target="_blank">
    <button class="delete" type="button" on:click={() => drawerOpen = false}></button>
    <div class="field">
      <input type="text" name="Email" hidden value={$user.email}>
      <label class="label">Feedback Type</label>
      <div class="control">
        <div class="select">
          <select bind:value={feedbackType} name="Feedback Type">
            <option value='bug'>Something's broken</option>
            <option value='wish'>I wish I could...</option>
            <option value='love'>I love being able to...</option>
            <option value='other'>Other</option>
          </select>
        </div>
      </div>
    </div>
    <div class="field">
      <label class="label">Details</label>
      <div class="control">
        <textarea name="Details" class="textarea" placeholder={feedbackLabels[1]} rows="8" bind:value={details}></textarea>
      </div>
    </div>
    <div class="field">
      <button class="button is-link is-fullwidth" type="submit" disabled={disableForm}>Submit</button>
    </div>
  </form>
</div>



<style>
  .feedback {
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    position: fixed;
    left: calc(100% - 41px);
    bottom: 7rem;
    z-index: 99999;
    transition: right 0.25s;
    will-change: right;
  }

  .drawer-open {
    right: 0;
    left: initial;
    transition: right 0.25s;
    will-change: right;
  }

  .button {
    border-radius: 0;
    box-shadow: 0px 0px 2px 0px rgba(0,0,0,0.5);
  }

  .delete {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
  }

  form {
    background-color: white;
    box-shadow: 0px 0px 2px 0px rgba(0,0,0,0.5);
    padding: 1rem;
  }
</style>