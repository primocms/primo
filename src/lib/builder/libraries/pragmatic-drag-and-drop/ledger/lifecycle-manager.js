import _toConsumableArray from "@babel/runtime/helpers/toConsumableArray";
import { bindAll } from 'bind-event-listener';
import { isLeavingWindow } from '../util/changing-window/is-leaving-window';
import { getBindingsForBrokenDrags } from '../util/detect-broken-drag';
import { fixPostDragPointerBug } from '../util/fix-post-drag-pointer-bug';
import { getInput } from '../util/get-input';
import { makeDispatch } from './dispatch-consumer-event';
var globalState = {
  isActive: false
};
function canStart() {
  return !globalState.isActive;
}
function getNativeSetDragImage(event) {
  if (event.dataTransfer) {
    // need to use `.bind` as `setDragImage` is required
    // to be run with `event.dataTransfer` as the "this" context
    return event.dataTransfer.setDragImage.bind(event.dataTransfer);
  }
  return null;
}
function hasHierarchyChanged(_ref) {
  var current = _ref.current,
    next = _ref.next;
  if (current.length !== next.length) {
    return true;
  }
  // not checking stickiness, data or dropEffect,
  // just whether the hierarchy has changed
  for (var i = 0; i < current.length; i++) {
    if (current[i].element !== next[i].element) {
      return true;
    }
  }
  return false;
}
function start(_ref2) {
  var event = _ref2.event,
    dragType = _ref2.dragType,
    getDropTargetsOver = _ref2.getDropTargetsOver,
    dispatchEvent = _ref2.dispatchEvent;
  if (!canStart()) {
    return;
  }
  var initial = getStartLocation({
    event: event,
    dragType: dragType,
    getDropTargetsOver: getDropTargetsOver
  });
  globalState.isActive = true;
  var state = {
    current: initial
  };

  // Setting initial drop effect for the drag
  setDropEffectOnEvent({
    event: event,
    current: initial.dropTargets
  });
  var dispatch = makeDispatch({
    source: dragType.payload,
    dispatchEvent: dispatchEvent,
    initial: initial
  });
  function updateDropTargets(next) {
    // only looking at whether hierarchy has changed to determine whether something as 'changed'
    var hasChanged = hasHierarchyChanged({
      current: state.current.dropTargets,
      next: next.dropTargets
    });

    // Always updating the state to include latest data, dropEffect and stickiness
    // Only updating consumers if the hierarchy has changed in some way
    // Consumers can get the latest data by using `onDrag`
    state.current = next;
    if (hasChanged) {
      dispatch.dragUpdate({
        current: state.current
      });
    }
  }
  function onUpdateEvent(event) {
    var input = getInput(event);
    var nextDropTargets = getDropTargetsOver({
      target: event.target,
      input: input,
      source: dragType.payload,
      current: state.current.dropTargets
    });
    if (nextDropTargets.length) {
      // 🩸 must call `event.preventDefault()` to allow a browser drop to occur
      event.preventDefault();
      setDropEffectOnEvent({
        event: event,
        current: nextDropTargets
      });
    }
    updateDropTargets({
      dropTargets: nextDropTargets,
      input: input
    });
  }
  function cancel() {
    // The spec behaviour is that when a drag is cancelled, or when dropping on no drop targets,
    // a "dragleave" event is fired on the active drop target before a "dragend" event.
    // We are replicating that behaviour in `cancel` if there are any active drop targets to
    // ensure consistent behaviour.
    //
    // Note: When cancelling, or dropping on no drop targets, a "dragleave" event
    // will have already cleared the dropTargets to `[]` (as that particular "dragleave" has a `relatedTarget` of `null`)

    if (state.current.dropTargets.length) {
      updateDropTargets({
        dropTargets: [],
        input: state.current.input
      });
    }
    dispatch.drop({
      current: state.current,
      updatedSourcePayload: null
    });
    finish();
  }
  function finish() {
    globalState.isActive = false;
    unbindEvents();
  }
  var unbindEvents = bindAll(window, [{
    // 👋 Note: we are repurposing the `dragover` event as our `drag` event
    // this is because firefox does not publish pointer coordinates during
    // a `drag` event, but does for every other type of drag event
    // `dragover` fires on all elements that are being dragged over
    // Because we are binding to `window` - our `dragover` is effectively the same as a `drag`
    // 🦊😤
    type: 'dragover',
    listener: function listener(event) {
      // We need to regularly calculate the drop targets in order to allow:
      //  - dynamic `canDrop()` checks
      //  - rapid updating `getData()` calls to attach data in response to user input (eg for edge detection)
      // Sadly we cannot schedule inspecting changes resulting from this event
      // we need to be able to conditionally cancel the event with `event.preventDefault()`
      // to enable the correct native drop experience.

      // 1. check to see if anything has changed
      onUpdateEvent(event);

      // 2. let consumers know a move has occurred
      // This will include the latest 'input' values
      dispatch.drag({
        current: state.current
      });
    }
  }, {
    type: 'dragenter',
    listener: onUpdateEvent
  }, {
    type: 'dragleave',
    listener: function listener(event) {
      if (!isLeavingWindow({
        dragLeave: event
      })) {
        return;
      }

      /**
       * At this point we don't know if a drag is being cancelled,
       * or if a drag is leaving the `window`.
       *
       * Both have:
       *   1. "dragleave" (with `relatedTarget: null`)
       *   2. "dragend" (a "dragend" can occur when outside the `window`)
       *
       * **Clearing drop targets**
       *
       * For either case we are clearing the the drop targets
       *
       * - cancelling: we clear drop targets in `"dragend"` anyway
       * - leaving the `window`: we clear the drop targets (to clear stickiness)
       *
       * **Leaving the window and finishing the drag**
       *
       * _internal drags_
       *
       * - The drag continues when the user is outside the `window`
       *   and can resume if the user drags back over the `window`,
       *   or end when the user drops in an external `window`.
       * - We will get a `"dragend"`, or we can listen for other
       *   events to determine the drag is finished when the user re-enters the `window`).
       *
       * _external drags_
       *
       * - We conclude the drag operation.
       * - We have no idea if the user will drag back over the `window`,
       *   or if the drag ends elsewhere.
       * - We will create a new drag if the user re-enters the `window`.
       *
       * **Not updating `input`**
       *
       * 🐛 Bug[Chrome] the final `"dragleave"` has default input values (eg `clientX == 0`)
       * Workaround: intentionally not updating `input` in "dragleave"
       * rather than the users current input values
       * - [Conversation](https://twitter.com/alexandereardon/status/1642697633864241152)
       * - [Bug](https://bugs.chromium.org/p/chromium/issues/detail?id=1429937)
       **/

      updateDropTargets({
        input: state.current.input,
        dropTargets: []
      });
      if (dragType.startedFrom === 'external') {
        cancel();
      }
    }
  }, {
    // A "drop" can only happen if the browser allowed the drop
    type: 'drop',
    listener: function listener(event) {
      /** If there are no drop targets, then we will get
       * a "drop" event if:
       * - `preventUnhandled()` is being used
       * - there is an unmanaged drop target (eg another library)
       * In these cases, it's up to the consumer
       * to handle the drop if it's not over one of our drop targets
       * - `preventUnhandled()` will cancel the "drop"
       * - unmanaged drop targets can handle the "drop" how they want to
       * We won't call `event.preventDefault()` in this call path */

      if (!state.current.dropTargets.length) {
        cancel();
        // not applying our post drop fix as we are not managing the drop
        return;
      }
      event.preventDefault();

      // applying the latest drop effect to the event
      setDropEffectOnEvent({
        event: event,
        current: state.current.dropTargets
      });
      dispatch.drop({
        current: state.current,
        // When dropping something native, we need to extract the latest
        // `.items` from the "drop" event as it is now accessible
        updatedSourcePayload: dragType.type === 'external' ? dragType.getDropPayload(event) : null
      });
      finish();

      // Applying this fix after `dispatch.drop` so that frameworks have the opportunity
      // to update UI in response to a "onDrop".
      if (dragType.startedFrom === 'internal') {
        fixPostDragPointerBug({
          current: state.current
        });
      }
    }
  }, {
    // "dragend" fires when on the drag source (eg a draggable element)
    // when the drag is finished.
    // "dragend" will fire after "drop" (if there was a successful drop)
    // "dragend" does not fire if the draggable source has been removed during the drag
    // or for external drag sources (eg files)

    // This "dragend" listener will not fire if there was a successful drop
    // as we will have already removed the event listener
    type: 'dragend',
    listener: function listener(event) {
      cancel();

      // Applying this fix after `dispatch.drop` so that frameworks have the opportunity
      // to update UI in response to a "onDrop".
      if (dragType.startedFrom === 'internal') {
        fixPostDragPointerBug({
          current: state.current
        });
      }
    }
  }].concat(_toConsumableArray(getBindingsForBrokenDrags({
    onDragEnd: cancel
  }))),
  // Once we have started a managed drag operation it is important that we see / own all drag events
  // We got one adoption bug pop up where some code was stopping (`event.stopPropagation()`)
  // all "drop" events in the bubble phase on the `document.body`.
  // This meant that we never saw the "drop" event.
  {
    capture: true
  });
  dispatch.start({
    nativeSetDragImage: getNativeSetDragImage(event)
  });
}
function setDropEffectOnEvent(_ref3) {
  var _current$;
  var event = _ref3.event,
    current = _ref3.current;
  // setting the `dropEffect` to be the innerMost drop targets dropEffect
  var innerMost = (_current$ = current[0]) === null || _current$ === void 0 ? void 0 : _current$.dropEffect;
  if (innerMost != null && event.dataTransfer) {
    event.dataTransfer.dropEffect = innerMost;
  }
}
function getStartLocation(_ref4) {
  var event = _ref4.event,
    dragType = _ref4.dragType,
    getDropTargetsOver = _ref4.getDropTargetsOver;
  var input = getInput(event);

  // When dragging from outside of the browser,
  // the drag is not being sourced from any local drop targets
  if (dragType.startedFrom === 'external') {
    return {
      input: input,
      dropTargets: []
    };
  }
  var dropTargets = getDropTargetsOver({
    input: input,
    source: dragType.payload,
    target: event.target,
    current: []
  });
  return {
    input: input,
    dropTargets: dropTargets
  };
}
export var lifecycle = {
  canStart: canStart,
  start: start
};