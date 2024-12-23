import _slicedToArray from "@babel/runtime/helpers/slicedToArray";
import { bind } from 'bind-event-listener';
import { makeAdapter } from '../make-adapter/make-adapter';
import { combine } from '../public-utils/combine';
import { addAttribute } from '../util/add-attribute';
import { androidFallbackText, isAndroid } from '../util/android';
import { getInput } from '../util/get-input';
import { textMediaType } from '../util/media-types/text-media-type';
import { urlMediaType } from '../util/media-types/url-media-type';
import { elementAdapterNativeDataKey } from './element-adapter-native-data-key';
var draggableRegistry = new WeakMap();
function addToRegistry(args) {
  draggableRegistry.set(args.element, args);
  return function cleanup() {
    draggableRegistry.delete(args.element);
  };
}
var adapter = makeAdapter({
  typeKey: 'element',
  defaultDropEffect: 'move',
  mount: function mount(api) {
    /**  Binding event listeners the `document` rather than `window` so that
     * this adapter always gets preference over the text adapter.
     * `document` is the first `EventTarget` under `window`
     * https://twitter.com/alexandereardon/status/1604658588311465985
     */
    return bind(document, {
      type: 'dragstart',
      listener: function listener(event) {
        var _entry$dragHandle, _entry$getInitialData, _entry$getInitialData2, _entry$dragHandle2, _entry$getInitialData3, _entry$getInitialData4;
        if (!api.canStart(event)) {
          return;
        }

        // If the "dragstart" event is cancelled, then a drag won't start
        // There will be no further drag operation events (eg no "dragend" event)
        if (event.defaultPrevented) {
          return;
        }

        // Technically `dataTransfer` can be `null` according to the types
        // But that behaviour does not seem to appear in the spec.
        // If there is not `dataTransfer`, we can assume something is wrong and not
        // start a drag
        if (!event.dataTransfer) {
          // Including this code on "test" and "development" environments:
          // - Browser tests commonly run against "development" builds
          // - Unit tests commonly run in "test"
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.warn("\n              It appears as though you have are not testing DragEvents correctly.\n\n              - If you are unit testing, ensure you have polyfilled DragEvent.\n              - If you are browser testing, ensure you are dispatching drag events correctly.\n\n              Please see our testing guides for more information:\n              https://atlassian.design/components/pragmatic-drag-and-drop/core-package/testing\n            ".replace(/ {2}/g, ''));
          }
          return;
        }

        // the closest parent that is a draggable element will be marked as
        // the `event.target` for the event
        var target = event.target;

        // this source is only for elements
        // Note: only HTMLElements can have the "draggable" attribute
        if (!(target instanceof HTMLElement)) {
          return null;
        }

        // see if the thing being dragged is owned by us
        var entry = draggableRegistry.get(target);

        // no matching element found
        // → dragging an element with `draggable="true"` that is not controlled by us
        if (!entry) {
          return null;
        }
        var input = getInput(event);
        var feedback = {
          element: entry.element,
          dragHandle: (_entry$dragHandle = entry.dragHandle) !== null && _entry$dragHandle !== void 0 ? _entry$dragHandle : null,
          input: input
        };

        // Check: does the draggable want to allow dragging?
        if (entry.canDrag && !entry.canDrag(feedback)) {
          // cancel drag operation if we cannot drag
          event.preventDefault();
          return null;
        }

        // Check: is there a drag handle and is the user using it?
        if (entry.dragHandle) {
          var over = document.elementFromPoint(input.clientX, input.clientY);

          // if we are not dragging from the drag handle (or something inside the drag handle)
          // then we will cancel the active drag
          if (!entry.dragHandle.contains(over)) {
            event.preventDefault();
            return null;
          }
        }

        /**
         *  **Goal**
         *  Pass information to other applications
         *
         * **Approach**
         *  Put data into the native data store
         *
         *  **What about the native adapter?**
         *  When the element adapter puts native data into the native data store
         *  the native adapter is not triggered in the current window,
         *  but a native adapter in an external window _can_ be triggered
         *
         *  **Why bake this into core?**
         *  This functionality could be pulled out and exposed inside of
         *  `onGenerateDragPreview`. But decided to make it a part of the
         *  base API as it felt like a common enough use case and ended
         *  up being a similar amount of code to include this function as
         *  it was to expose the hook for it
         */
        var nativeData = (_entry$getInitialData = (_entry$getInitialData2 = entry.getInitialDataForExternal) === null || _entry$getInitialData2 === void 0 ? void 0 : _entry$getInitialData2.call(entry, feedback)) !== null && _entry$getInitialData !== void 0 ? _entry$getInitialData : null;
        if (nativeData) {
          for (var _i = 0, _Object$entries = Object.entries(nativeData); _i < _Object$entries.length; _i++) {
            var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
              key = _Object$entries$_i[0],
              data = _Object$entries$_i[1];
            event.dataTransfer.setData(key, data !== null && data !== void 0 ? data : '');
          }
        }

        /**
         *  📱 For Android devices, a drag operation will not start unless
         * "text/plain" or "text/uri-list" data exists in the native data store
         * https://twitter.com/alexandereardon/status/1732189803754713424
         *
         * Tested on:
         * Device: Google Pixel 5
         * Android version: 14 (November 5, 2023)
         * Chrome version: 120.0
         */
        var types = event.dataTransfer.types;
        if (isAndroid() && !types.includes(textMediaType) && !types.includes(urlMediaType)) {
          event.dataTransfer.setData(textMediaType, androidFallbackText);
        }

        /**
         * 1. Must set any media type for `iOS15` to work
         * 2. We are also doing adding data so that the native adapter
         * can know that the element adapter has handled this drag
         *
         * We used to wrap this `setData()` in a `try/catch` for Firefox,
         * but it looks like that was not needed.
         *
         * Tested using: https://codesandbox.io/s/checking-firefox-throw-behaviour-on-dragstart-qt8h4f
         *
         * - ✅ Firefox@70.0 (Oct 2019) on macOS Sonoma
         * - ✅ Firefox@70.0 (Oct 2019) on macOS Big Sur
         * - ✅ Firefox@70.0 (Oct 2019) on Windows 10
         *
         * // just checking a few more combinations to be super safe
         *
         * - ✅ Chrome@78 (Oct 2019) on macOS Big Sur
         * - ✅ Chrome@78 (Oct 2019) on Windows 10
         * - ✅ Safari@14.1 on macOS Big Sur
         */
        event.dataTransfer.setData(elementAdapterNativeDataKey, '');
        var payload = {
          element: entry.element,
          dragHandle: (_entry$dragHandle2 = entry.dragHandle) !== null && _entry$dragHandle2 !== void 0 ? _entry$dragHandle2 : null,
          data: (_entry$getInitialData3 = (_entry$getInitialData4 = entry.getInitialData) === null || _entry$getInitialData4 === void 0 ? void 0 : _entry$getInitialData4.call(entry, feedback)) !== null && _entry$getInitialData3 !== void 0 ? _entry$getInitialData3 : {}
        };
        var dragType = {
          type: 'element',
          payload: payload,
          startedFrom: 'internal'
        };
        api.start({
          event: event,
          dragType: dragType
        });
      }
    });
  },
  dispatchEventToSource: function dispatchEventToSource(_ref) {
    var _draggableRegistry$ge, _draggableRegistry$ge2;
    var eventName = _ref.eventName,
      payload = _ref.payload;
    // During a drag operation, a draggable can be:
    // - remounted with different functions
    // - removed completely
    // So we need to get the latest entry from the registry in order
    // to call the latest event functions

    (_draggableRegistry$ge = draggableRegistry.get(payload.source.element)) === null || _draggableRegistry$ge === void 0 || (_draggableRegistry$ge2 = _draggableRegistry$ge[eventName]) === null || _draggableRegistry$ge2 === void 0 || _draggableRegistry$ge2.call(_draggableRegistry$ge,
    // I cannot seem to get the types right here.
    // TS doesn't seem to like that one event can need `nativeSetDragImage`
    // @ts-expect-error
    payload);
  }
});
export var dropTargetForElements = adapter.dropTarget;
export var monitorForElements = adapter.monitor;
export function draggable(args) {
  // Guardrail: warn if the drag handle is not contained in draggable element
  if (process.env.NODE_ENV !== 'production') {
    if (args.dragHandle && !args.element.contains(args.dragHandle)) {
      // eslint-disable-next-line no-console
      console.warn('Drag handle element must be contained in draggable element', {
        element: args.element,
        dragHandle: args.dragHandle
      });
    }
  }
  // Guardrail: warn if the draggable element is already registered
  if (process.env.NODE_ENV !== 'production') {
    var existing = draggableRegistry.get(args.element);
    if (existing) {
      // eslint-disable-next-line no-console
      console.warn('You have already registered a `draggable` on the same element', {
        existing: existing,
        proposed: args
      });
    }
  }
  return combine(
  // making the draggable register the adapter rather than drop targets
  // this is because you *must* have a draggable element to start a drag
  // but you _might_ not have any drop targets immediately
  // (You might create drop targets async)
  adapter.registerUsage(), addToRegistry(args), addAttribute(args.element, {
    attribute: 'draggable',
    value: 'true'
  }));
}

/** Common event payload for all events */

/** A map containing payloads for all events */

/** Common event payload for all drop target events */

/** A map containing payloads for all events on drop targets */

/** Arguments given to all feedback functions (eg `canDrag()`) on for a `draggable()` */

/** Arguments given to all feedback functions (eg `canDrop()`) on a `dropTargetForElements()` */

/** Arguments given to all monitor feedback functions (eg `canMonitor()`) for a `monitorForElements` */