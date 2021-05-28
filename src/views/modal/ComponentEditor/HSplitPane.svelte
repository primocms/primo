<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher()
  let leftSeparator, rightSeparator;
  let transitioning = false
  export let resetSize = () => {
    transitioning = true
    if (left) left.removeAttribute('style');
    if (center) center.removeAttribute('style');
    if (right) right.removeAttribute('style');
    if (leftSeparator) leftSeparator.removeAttribute('style');
    if (rightSeparator) rightSeparator.removeAttribute('style');
    setTimeout(() => {
      transitioning = false
    }, 100)
  }
  export let updateCallback = () => {
      // do nothing
      return;
  }
  let md;
  const onMouseDownLeft = (e) => {
      dispatch('mousedown', e)
      e.preventDefault();
      if (e.button !== 0) return;
      md = {e,
          leftOffsetLeft:  leftSeparator.offsetLeft,
          leftOffsetTop:   leftSeparator.offsetTop,
          rightOffsetLeft:  rightSeparator.offsetLeft,
          rightOffsetTop:   rightSeparator.offsetTop,
          firstWidth:  left.offsetWidth,
          centerWidth: center.offsetWidth,
          secondWidth: right.offsetWidth
      };
      window.addEventListener('mousemove', onMouseMoveLeft);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onMouseMoveLeft);
      window.addEventListener('touchend', onMouseUp);
  }

  const onMouseMoveLeft = (e) => {
    dispatch('mousedown', e)
      e.preventDefault();
      if (e.button !== 0) return;
      var delta = {
        x: e.clientX - md.e.clientX,
        y: e.clientY - md.e.clientY
      };
      // Prevent negative-sized elements
      delta.x = Math.min(
        Math.max(delta.x, -(md.firstWidth + md.centerWidth)), 
        md.secondWidth + md.centerWidth
      );
      leftSeparator.style.left = md.leftOffsetLeft + delta.x + "px";
      left.style.width = md.firstWidth + delta.x + "px";
      center.style.width = (md.centerWidth - (delta.x/2)) + "px";
      right.style.width = (md.secondWidth - (delta.x/2)) + "px";
      updateCallback();
  }

  const onMouseDownRight = (e) => {
      dispatch('mousedown', e)
      e.preventDefault();
      if (e.button !== 0) return;
      md = {e,
          leftOffsetLeft:  leftSeparator.offsetLeft,
          leftOffsetTop:   leftSeparator.offsetTop,
          rightOffsetLeft:  rightSeparator.offsetLeft,
          rightOffsetTop:   rightSeparator.offsetTop,
          firstWidth:  left.offsetWidth,
          centerWidth: center.offsetWidth,
          secondWidth: right.offsetWidth
      };
      window.addEventListener('mousemove', onMouseMoveRight);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('touchmove', onMouseMoveRight);
      window.addEventListener('touchend', onMouseUp);
  }

  const onMouseMoveRight = (e) => {
      e.preventDefault();
      if (e.button !== 0) return;
      var delta = {
        x: e.clientX - md.e.clientX,
        y: e.clientY - md.e.clientY
      };
      // Prevent negative-sized elements
      delta.x = Math.min(
        Math.max(delta.x, -(md.secondWidth + md.centerWidth)), 
        md.firstWidth + md.centerWidth
      );

      rightSeparator.style.left = md.firstWidth + (delta.x/2) + (md.centerWidth - (delta.x/2)) + "px"
      left.style.width = md.firstWidth + (delta.x/2) + "px";
      center.style.width = md.centerWidth + (delta.x/2) + "px";
      right.style.width = md.secondWidth - delta.x + "px";
      updateCallback();
  }
  const onMouseUp = (e) => {
      if (e) {
          e.preventDefault();
          if (e.button !== 0) return;
      }
      updateCallback();
      window.removeEventListener('mousemove', onMouseMoveLeft);
      window.removeEventListener('mousemove', onMouseMoveRight);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onMouseMoveLeft);
      window.removeEventListener('touchmove', onMouseMoveRight);
      window.removeEventListener('touchend', onMouseUp);
  }
  function onResize() {
      onMouseUp();
      resetSize();
  }
  onMount(() => {
      window.addEventListener('resize', onResize);
  });
  onDestroy(() => {
      window.removeEventListener('resize', onResize);
  });

  let left, center, right;
  export let leftPaneSize = '33%';
  export let minLeftPaneSize = '0';
  export let centerPaneSize = '33%';
  export let minCenterPaneSize = '0';
  export let rightPaneSize = '33%';
  export let minRightPaneSize = '0';
  
  $: leftPaneSize && resetSize();
  $: rightPaneSize && resetSize();
</script>

<div class="wrapper" style="
  --left-panel-size: {leftPaneSize}; 
  --min-left-panel-size: {minLeftPaneSize}; 

  --center-panel-size: {centerPaneSize}; 
  --min-center-panel-size: {minCenterPaneSize}; 

  --right-panel-size: {rightPaneSize}; 
  --min-right-panel-size: {minRightPaneSize};
  ">
  <div bind:this={left} class="left" class:transitioning>
      <slot name="left">
          <div style="background-color: red;">
              Left Contents goes here...
          </div>
      </slot>
  </div>
  <div bind:this={leftSeparator} class="separator" on:mousedown={onMouseDownLeft} on:touchstart={onMouseDownLeft}>
  </div>
  <div bind:this={center} class="center" class:transitioning>
      <slot name="center">
          <div style="background-color: yellow;">
              Center Contents goes here...
          </div>
      </slot>
  </div>
  <div bind:this={rightSeparator} class="separator" on:mousedown={onMouseDownRight} on:touchstart={onMouseDownRight}>
  </div>
  <div bind:this={right} class="right" class:transitioning>
    <slot name="right">
        <div style="background-color: yellow;">
            Right Contents goes here...
        </div>
    </slot>
</div>
</div>

<style>
  div.wrapper {
      width: 100%;
      height: 100%;
      /* background-color: yellow; */
      display: inline-flex;
  }
  div.separator {
      cursor: col-resize;
      height: auto;
      width: 4px;
      margin-left: -2px;
      z-index: 1;
      @apply bg-gray-800;
  }
  div.left {
      width: var(--left-panel-size);
      min-width: var(--min-left-panel-size);
      height: 100%;
  }
  div.center {
      width: var(--center-panel-size);
      min-width: var(--min-center-panel-size);
      height: 100%;
  }
  div.right {
      width: var(--right-panel-size);
      min-width: var(--min-right-panel-size);
      display: flex;
  }
  .transitioning {
    transition: width 0.1s;
  }
</style>