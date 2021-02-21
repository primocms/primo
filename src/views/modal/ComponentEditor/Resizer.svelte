<script>
  import {createEventDispatcher} from 'svelte'
  const dispatch = createEventDispatcher()

  export let left

  let preview

  let resizingPreview = false

  function draggable(node) {
    let x

    function handleMousedown(event) {
      if (!resizingPreview) {
        x = event.clientX;
        resizingPreview = true
        window.addEventListener('mousemove', handleMousemove);
        window.addEventListener('mouseup', handleMouseup);
      }
    }

    function handleMousemove(event) {
      const dx = event.clientX - x;
		  x = event.clientX;

      if (resizingPreview) {
        dispatch('resize', dx)
      } 
    }

    function handleMouseup(event) {
      x = event.clientX;
      resizingPreview = false
      dispatch('release')

      window.removeEventListener('mousemove', handleMousemove);
      window.removeEventListener('mouseup', handleMouseup);
    }

    node.addEventListener('mousedown', handleMousedown);

    return {
      destroy() {
        node.removeEventListener('mousedown', handleMousedown);
      }
    };
  }
</script>

<button style="left:{left}px" class="hidden md:block w-4 h-full absolute left-1/2 z-10 focus:outline-none" aria-label="resize preview" use:draggable>
  <svg class="h-4 w-4 text-gray-600 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5h2v14H8zM14 5h2v14h-2z"></path>
  </svg>
</button>

<style>
  button {
    cursor: ew-resize;
  }
</style>