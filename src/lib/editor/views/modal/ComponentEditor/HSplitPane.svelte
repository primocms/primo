<script>
  // Based on https://github.com/Readiz/svelte-split-pane
  import { onMount, onDestroy, createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
  let leftSeparator, rightSeparator
  let transitioning = false
  let dragging = false

  let breakpointWidth = 0

  export let resetSize = () => {
    transitioning = true
    if (center) {
      center.removeAttribute('style')
      rightPaneSize = '33%'
      leftPaneSize = '33%'
      centerPaneSize = '33%'
    } else {
      rightPaneSize = '50%'
      leftPaneSize = '50%'
    }
    if (right) right.removeAttribute('style')
    if (leftSeparator) leftSeparator.removeAttribute('style')
    if (rightSeparator) rightSeparator.removeAttribute('style')
    setTimeout(() => {
      transitioning = false
    }, 100)
  }
  export let updateCallback = () => {
    // do nothing
    return
  }
  let md
  const onMouseDownLeft = (e) => {
    dragging = true
    dispatch('mousedown', e)
    e.preventDefault()
    if (e.button !== 0) return
    md = {
      e,
      leftOffsetLeft: leftSeparator.offsetLeft,
      leftOffsetTop: leftSeparator.offsetTop,
      rightOffsetLeft: rightSeparator ? rightSeparator.offsetLeft : null,
      rightOffsetTop: rightSeparator ? rightSeparator.offsetTop : null,
      firstWidth: left.offsetWidth,
      centerWidth: center ? center.offsetWidth : null,
      secondWidth: right.offsetWidth,
      firstHeight: left.offsetHeight,
      secondHeight: right.offsetHeight,
    }
    window.addEventListener('mousemove', onMouseMoveLeft)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onMouseMoveLeft)
    window.addEventListener('touchend', onMouseUp)
  }

  const onMouseMoveLeft = (e) => {
    // assumes no center column for now
    const width = (parseInt(rightPaneSize) / parseInt(leftPaneSize) / 2) * 100
    // dispatch('resize', {
    //   right: Math.round(width) + '%',
    //   left: Math.round(100 - width) + '%',
    // });
    // dispatch('mousedown', e)
    e.preventDefault()
    if (e.button !== 0) return
    var delta = {
      x: e.clientX - md.e.clientX,
      y: e.clientY - md.e.clientY,
    }
    // Prevent negative-sized elements
    // delta.x = Math.min(
    //   Math.max(delta.x, -(md.firstWidth + md.centerWidth)),
    //   md.secondWidth + md.centerWidth
    // );

    if ($$slots.center) {
      if (rightPaneSize === '0') {
        const leftDelta = md.firstWidth + delta.x
        leftPaneSize = leftDelta >= breakpointWidth ? leftDelta + 'px' : 0

        const centerDelta = md.centerWidth - delta.x
        centerPaneSize = centerDelta >= breakpointWidth ? centerDelta + 'px' : 0
      } else {
        const leftDelta = md.firstWidth + delta.x / 2
        leftPaneSize = leftDelta >= 0 ? leftDelta + 'px' : 0

        const centerDelta = md.centerWidth + delta.x / 2
        centerPaneSize = centerDelta >= breakpointWidth ? centerDelta + 'px' : 0

        const rightDelta = md.secondWidth - delta.x
        rightPaneSize = rightDelta >= breakpointWidth ? rightDelta + 'px' : 0
      }
    } else {
      // set shrink limit
      const updatedSizes = {
        top: md.firstHeight + delta.y,
        bottom: md.secondHeight - delta.y,
        left: md.firstWidth + delta.x,
        right: md.secondWidth - delta.x,
      }

      const minSizes = {
        top: 0,
        left: 0,
        right: 0,
        bottom: 37,
      }

      // if the top is smaller than the min, subtract the extra from it and add to the bottom
      if (orientation === 'vertical') {
        if (minSizes.top > updatedSizes.top) {
          const overflow = updatedSizes.top - minSizes.top + 3
          updatedSizes.top = updatedSizes.top - overflow + 3
          updatedSizes.bottom = updatedSizes.bottom + overflow
        } else if (minSizes.bottom > updatedSizes.bottom) {
          const overflow = updatedSizes.bottom - minSizes.bottom
          updatedSizes.top = updatedSizes.top + overflow + 3
          updatedSizes.bottom = updatedSizes.bottom - overflow + 3
        } else {
          updatedSizes.top = updatedSizes.top + 3
          updatedSizes.bottom = updatedSizes.bottom + 3
        }
        bottomPaneSize = updatedSizes.bottom + 'px'
        topPaneSize = updatedSizes.top + 'px'
      } else if (orientation === 'horizontal') {
        if (minSizes.left > updatedSizes.left) {
          const overflow = updatedSizes.left - minSizes.left
          updatedSizes.left = updatedSizes.left - overflow
          updatedSizes.right = updatedSizes.right + overflow
        } else if (minSizes.right > updatedSizes.right) {
          const overflow = updatedSizes.right - minSizes.right
          updatedSizes.left = updatedSizes.left + overflow
          updatedSizes.right = updatedSizes.right - overflow
        }
        leftPaneSize = updatedSizes.left + 'px'
        rightPaneSize = updatedSizes.right + 'px'
      }
    }
    updateCallback()
  }

  const onMouseDownRight = (e) => {
    dragging = true
    dispatch('mousedown', e)
    e.preventDefault()
    if (e.button !== 0) return
    md = {
      e,
      leftOffsetLeft: leftSeparator.offsetLeft,
      leftOffsetTop: leftSeparator.offsetTop,
      rightOffsetLeft: rightSeparator.offsetLeft,
      rightOffsetTop: rightSeparator.offsetTop,
      firstWidth: left.offsetWidth,
      centerWidth: center.offsetWidth,
      secondWidth: right.offsetWidth,
    }
    window.addEventListener('mousemove', onMouseMoveRight)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('touchmove', onMouseMoveRight)
    window.addEventListener('touchend', onMouseUp)
  }

  const onMouseMoveRight = (e) => {
    e.preventDefault()
    if (e.button !== 0) return
    var delta = {
      x: e.clientX - md.e.clientX,
      y: e.clientY - md.e.clientY,
    }
    // Prevent negative-sized elements
    delta.x = Math.min(
      Math.max(delta.x, -(md.secondWidth + md.centerWidth)),
      md.firstWidth + md.centerWidth
    )

    if ($$slots.center) {
      const leftDelta = md.firstWidth + delta.x / 2
      leftPaneSize = leftDelta >= breakpointWidth ? leftDelta + 'px' : 0

      const centerDelta = md.centerWidth + delta.x / 2
      centerPaneSize = centerDelta >= breakpointWidth ? centerDelta + 'px' : 0

      const rightDelta = md.secondWidth - delta.x
      rightPaneSize = rightDelta >= breakpointWidth ? rightDelta + 'px' : 0
    } else {
      leftPaneSize = md.firstWidth + delta.x + 'px'
      rightPaneSize = md.secondWidth - delta.x + 'px'
    }

    updateCallback()
  }
  const onMouseUp = (e) => {
    dragging = false
    if (e) {
      e.preventDefault()
      if (e.button !== 0) return
    }
    updateCallback()
    window.removeEventListener('mousemove', onMouseMoveLeft)
    window.removeEventListener('mousemove', onMouseMoveRight)
    window.removeEventListener('mouseup', onMouseUp)
    window.removeEventListener('touchmove', onMouseMoveLeft)
    window.removeEventListener('touchmove', onMouseMoveRight)
    window.removeEventListener('touchend', onMouseUp)
  }
  function onResize() {
    onMouseUp()
    resetSize()
  }
  onMount(() => {
    // window.addEventListener('resize', onResize);
  })
  onDestroy(() => {
    // window.removeEventListener('resize', onResize);
  })

  let left, center, right

  export let hideRightPanel = false

  export let leftPaneSize = $$slots.center ? '33%' : '66%'
  export let minLeftPaneSize = '1.5rem'
  export let centerPaneSize = '33%'
  export let minCenterPaneSize = '1.5rem'
  export let rightPaneSize = $$slots.center ? '33%' : '66%'
  export let minRightPaneSize = '1.5rem'

  export let topPaneSize = '50%'
  export let bottomPaneSize = '50%'

  export let orientation = 'horizontal'

  export let hideLeftOverflow = false
</script>

<div
  class="wrapper {orientation}"
  style="
  --left-pane-size: {leftPaneSize}; 
  --min-left-pane-size: {minLeftPaneSize}; 

  --center-pane-size: {centerPaneSize}; 
  --min-center-pane-size: {minCenterPaneSize}; 

  --right-pane-size: {rightPaneSize}; 
  --min-right-pane-size: {minRightPaneSize};

  --top-pane-size: {topPaneSize};
  --bottom-pane-size: {bottomPaneSize};
  "
>
  {#if $$slots.center}
    <div
      bind:this={left}
      class:overflow-hidden={hideLeftOverflow}
      class="left"
      class:transitioning
    >
      <slot name="left">
        <div style="background-color: red;">Left Contents goes here...</div>
      </slot>
    </div>
    <div
      bind:this={leftSeparator}
      class="separator"
      class:dragging
      on:mousedown={onMouseDownLeft}
      on:touchstart={onMouseDownLeft}
    />
    <div bind:this={center} class="center" class:transitioning>
      <slot name="center">
        <div style="background-color: yellow;">
          Center Contents goes here...
        </div>
      </slot>
    </div>
    {#if !hideRightPanel}
      <div
        bind:this={rightSeparator}
        class="separator"
        class:dragging
        on:mousedown={onMouseDownRight}
        on:touchstart={onMouseDownRight}
      />
      <div bind:this={right} class="right" class:transitioning>
        <slot name="right">
          <div style="background-color: yellow;">
            Right Contents goes here...
          </div>
        </slot>
      </div>
    {/if}
  {:else}
    <div
      bind:this={left}
      class="left"
      class:overflow-hidden={hideLeftOverflow}
      class:transitioning
    >
      <slot name="left">
        <div style="background-color: red;">Left Contents goes here...</div>
      </slot>
    </div>
    {#if !hideRightPanel}
      <div
        bind:this={leftSeparator}
        class="separator"
        class:dragging
        on:mousedown={onMouseDownLeft}
        on:touchstart={onMouseDownLeft}
      />
      <div bind:this={right} class="right" class:transitioning>
        <slot name="right">
          <div style="background-color: yellow;">
            Right Contents goes here...
          </div>
        </slot>
      </div>
    {/if}
  {/if}
</div>

<style lang="postcss">
  .wrapper.vertical {
    display: grid;
    grid-template-rows: calc(var(--top-pane-size, 1fr) - 3px) 6px calc(
        var(--bottom-pane-size, 1fr) - 3px
      );
    /* height: calc(100% - 45px); */

    & > div.left,
    & > div.right {
      width: 100%;
    }

    & > div.separator {
      width: 100%;
      height: 100%;
      cursor: row-resize;
    }
  }

  .wrapper.horizontal {
    display: flex;
    /* height: calc(100% - 40px); */
  }
  div.wrapper {
    width: 100%;
    height: 100%;
    /* height: 100%; */ /* causing overflow in ComponentEditor code view */
  }
  div.separator {
    /* background: var(--color-gray-8); */
    background: #222;
    color: var(--color-gray-2);
    cursor: col-resize;
    height: auto;
    width: 4px;
    z-index: 1;
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
  .left,
  .center,
  .right {
    position: relative;
    transition: 0.1s width;
  }
  div.left {
    width: var(--left-pane-size);
    min-width: var(--min-left-pane-size);
    /* height: 100%; */
    /*  overflow-y: scroll; Necessary to scroll content in CMS fields */
  }
  div.center {
    width: var(--center-pane-size);
    min-width: var(--min-center-pane-size);
    height: 100%;
  }
  div.right {
    width: var(--right-pane-size);
    min-width: var(--min-right-pane-size);
    display: flex;
  }
  .transitioning {
    transition: width 0.1s;
  }
  .overflow-hidden {
    overflow: hidden !important;
  }
</style>
