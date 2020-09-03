<script>
  import {hideReleaseNotes} from '../@stores/app'
  import modal from '../@stores/app/modal'
  
</script>

<iframe title="primo release notes" src="https://www.youtube.com/embed/skmXGM17Zi4" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

<div class="my-4">
  <h1 class="text-xl font-semibold">Version 0.2</h1>
  <ul class="list-disc ml-5">
    <li>Even simpler toolbar (no more duplicate icons)</li>
    <li>primo dropdown (site switcher, Get Help and Sign Out buttons)</li>
    <li>Redesigned page switcher</li>
    <li>HTML for page/site (head embed, before-closing-body-tag)</li>
    <li>‘Change view’ in component/page/site preview</li>
    <li>Page/Site fields</li>
    <li>Separate developer & content views</li>
    <li>Section outline</li>
    <li>Modal now reads 'Pushing to Github' instead of 'Pusing to Github'</li>
  </ul>
  <button class="hide-this" on:click={() => {
    hideReleaseNotes.set(true)
    window.localStorage.setItem('hideReleaseNotes', true)
    modal.hide()
  }}>Got it</button>
</div>

<style>
  iframe {
    @apply w-full;
  }
  .hide-this {
    @apply w-full bg-primored rounded py-2 mt-2 text-white text-sm font-bold transition-colors duration-200;
    &:hover {
      @apply bg-red-500;
    }
  }
</style>