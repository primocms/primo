<script>
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher();

  export let time = 1000
  export let interval = 1
  export let variants = ''

  let deletionProgress = 0
  let countdown = setInterval(() => {
    if (deletionProgress < time) deletionProgress++
    else {
      dispatch('end')
      deletionProgress = time
      clearInterval(countdown)
    }
  }, interval)

  function undoCountdown() {
    deletionProgress = 0
    clearInterval(countdown)
    dispatch('undo')
  }

</script>

<div class="w-full flex {variants}">
  <progress class="w-full rounded overflow-hidden h-full" value={deletionProgress} max={time}></progress>
  <button class="font-medium text-sm bg-gray-800 px-2 py-1 rounded text-gray-100 ml-2" on:click={undoCountdown}>Undo</button>
</div>


<style>
  progress::-webkit-progress-bar {
      @apply bg-gray-500;
  }

  progress::-webkit-progress-value {
      @apply bg-red-500;
  }
</style>