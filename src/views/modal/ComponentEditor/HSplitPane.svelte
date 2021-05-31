<script>
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher()
  let leftSeparator, rightSeparator;
  let transitioning = false
  let dragging = false
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
      dragging = true
      dispatch('mousedown', e)
      e.preventDefault();
      if (e.button !== 0) return;
      md = {e,
          leftOffsetLeft:  leftSeparator.offsetLeft,
          leftOffsetTop:   leftSeparator.offsetTop,
          rightOffsetLeft:  rightSeparator ? rightSeparator.offsetLeft : null,
          rightOffsetTop:   rightSeparator ? rightSeparator.offsetTop : null,
          firstWidth:  left.offsetWidth,
          centerWidth: center ? center.offsetWidth : null,
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

      if ($$slots.center) {
        rightSeparator.style.left = md.firstWidth + (delta.x/2) + (md.centerWidth - (delta.x/2)) + "px"
        left.style.width = md.firstWidth + (delta.x/2) + "px";
        center.style.width = md.centerWidth + (delta.x/2) + "px";
        right.style.width = md.secondWidth - delta.x + "px";
      } else {
        leftSeparator.style.left = md.firstWidth + delta.x
        left.style.width = md.firstWidth + delta.x + "px";
        right.style.width = md.secondWidth - delta.x + "px";
      }
      updateCallback();
  }

  const onMouseDownRight = (e) => {
      dragging = true
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

      if ($$slots.center) {
        rightSeparator.style.left = md.firstWidth + (delta.x/2) + (md.centerWidth - (delta.x/2)) + "px"
        left.style.width = md.firstWidth + (delta.x/2) + "px";
        center.style.width = md.centerWidth + (delta.x/2) + "px";
        right.style.width = md.secondWidth - delta.x + "px";
      } else {
        leftSeparator.style.left = md.firstWidth + delta.x
        left.style.width = md.firstWidth + delta.x + "px";
        right.style.width = md.secondWidth - delta.x + "px";
      }

      updateCallback();
  }
  const onMouseUp = (e) => {
      dragging = false
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
  export let leftPaneSize = $$slots.center ? '33%' : '66%';
  export let minLeftPaneSize = '0';
  export let centerPaneSize = '33%';
  export let minCenterPaneSize = '0';
  export let rightPaneSize = $$slots.center ? '33%' : '66%';
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
  {#if $$slots.center}
    <div bind:this={left} class="left" class:transitioning>
        <slot name="left">
            <div style="background-color: red;">
                Left Contents goes here...
            </div>
        </slot>
    </div>
    <div bind:this={leftSeparator} class="separator" class:dragging on:mousedown={onMouseDownLeft} on:touchstart={onMouseDownLeft}>
    </div>
    <div bind:this={center} class="center" class:transitioning>
        <slot name="center">
            <div style="background-color: yellow;">
                Center Contents goes here...
            </div>
        </slot>
    </div>
    <div bind:this={rightSeparator} class="separator" class:dragging on:mousedown={onMouseDownRight} on:touchstart={onMouseDownRight}>
    </div>
    <div bind:this={right} class="right" class:transitioning>
        <slot name="right">
            <div style="background-color: yellow;">
                Right Contents goes here...
            </div>
        </slot>
    </div>
  {:else}
    <div bind:this={left} class="left" class:transitioning>
        <slot name="left">
            <div style="background-color: red;">
                Left Contents goes here...
            </div>
        </slot>
    </div>
    <div bind:this={leftSeparator} class="separator" class:dragging on:mousedown={onMouseDownLeft} on:touchstart={onMouseDownLeft}></div>
    <div bind:this={right} class="right" class:transitioning>
        <slot name="right">
            <div style="background-color: yellow;">
                Right Contents goes here...
            </div>
        </slot>
    </div>
  {/if}
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
      margin: 0 4px;
      z-index: 1;
      @apply bg-gray-800 text-gray-200;
      background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='30'><path d='M2 0 v30 M5 0 v30 M8 0 v30' fill='none' stroke='currentColor'/></svg>");
      background-size: 20px 30px;
      background-repeat: no-repeat;
      background-position: center;
  }
  div.separator.dragging:before {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        content: '';
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