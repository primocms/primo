import rafSchd from 'raf-schd';
var scheduleOnDrag = rafSchd(function (fn) {
  return fn();
});
var dragStart = function () {
  var scheduled = null;
  function schedule(fn) {
    var frameId = requestAnimationFrame(function () {
      scheduled = null;
      fn();
    });
    scheduled = {
      frameId: frameId,
      fn: fn
    };
  }
  function flush() {
    if (scheduled) {
      cancelAnimationFrame(scheduled.frameId);
      scheduled.fn();
      scheduled = null;
    }
  }
  return {
    schedule: schedule,
    flush: flush
  };
}();
export function makeDispatch(_ref) {
  var source = _ref.source,
    initial = _ref.initial,
    dispatchEvent = _ref.dispatchEvent;
  var previous = {
    dropTargets: []
  };
  function safeDispatch(args) {
    dispatchEvent(args);
    previous = {
      dropTargets: args.payload.location.current.dropTargets
    };
  }
  var dispatch = {
    start: function start(_ref2) {
      var nativeSetDragImage = _ref2.nativeSetDragImage;
      // Ensuring that both `onGenerateDragPreview` and `onDragStart` get the same location.
      // We do this so that `previous` is`[]` in `onDragStart` (which is logical)
      var location = {
        current: initial,
        previous: previous,
        initial: initial
      };
      // a `onGenerateDragPreview` does _not_ add another entry for `previous`
      // onDragPreview
      safeDispatch({
        eventName: 'onGenerateDragPreview',
        payload: {
          source: source,
          location: location,
          nativeSetDragImage: nativeSetDragImage
        }
      });
      dragStart.schedule(function () {
        safeDispatch({
          eventName: 'onDragStart',
          payload: {
            source: source,
            location: location
          }
        });
      });
    },
    dragUpdate: function dragUpdate(_ref3) {
      var current = _ref3.current;
      dragStart.flush();
      scheduleOnDrag.cancel();
      safeDispatch({
        eventName: 'onDropTargetChange',
        payload: {
          source: source,
          location: {
            initial: initial,
            previous: previous,
            current: current
          }
        }
      });
    },
    drag: function drag(_ref4) {
      var current = _ref4.current;
      scheduleOnDrag(function () {
        dragStart.flush();
        var location = {
          initial: initial,
          previous: previous,
          current: current
        };
        safeDispatch({
          eventName: 'onDrag',
          payload: {
            source: source,
            location: location
          }
        });
      });
    },
    drop: function drop(_ref5) {
      var current = _ref5.current,
        updatedSourcePayload = _ref5.updatedSourcePayload;
      dragStart.flush();
      scheduleOnDrag.cancel();
      safeDispatch({
        eventName: 'onDrop',
        payload: {
          source: updatedSourcePayload !== null && updatedSourcePayload !== void 0 ? updatedSourcePayload : source,
          location: {
            current: current,
            previous: previous,
            initial: initial
          }
        }
      });
    }
  };
  return dispatch;
}