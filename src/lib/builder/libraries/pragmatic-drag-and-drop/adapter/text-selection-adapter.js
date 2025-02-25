import { bindAll } from 'bind-event-listener';
import { makeAdapter } from '../make-adapter/make-adapter';
import { isSafari } from '../util/is-safari';
import { HTMLMediaType } from '../util/media-types/html-media-type';
import { textMediaType } from '../util/media-types/text-media-type';
import { elementAdapterNativeDataKey } from './element-adapter-native-data-key';
function findTextNode(event) {
  var _event$dataTransfer;
  // Standard: the `event.target` should be the closest `Text` node.
  if (event.target instanceof Text) {
    return event.target;
  }

  // Structuring things this way so that if Safari fixes their bug
  // then the standard check will start working
  if (!isSafari()) {
    return null;
  }

  /**
   * According to the spec, `event.target` should be the `Text` node that
   * the drag started from when dragging a text selection.
   *
   * → https://html.spec.whatwg.org/multipage/dnd.html#drag-and-drop-processing-model
   *
   * However, in Safari the closest `HTMLElement` is returned.
   * So we need to figure out if text is dragging ourselves.
   *
   * → https://bugs.webkit.org/show_bug.cgi?id=268959
   */
  if (!(event.target instanceof HTMLElement)) {
    return null;
  }

  // unlikely that this particular drag is a text selection drag
  if (event.target.draggable) {
    return null;
  }

  // if the drag contains no text data, then not dragging selected text
  // return `null` if there is no dataTransfer, or if `getData()` returns ""
  if (!((_event$dataTransfer = event.dataTransfer) !== null && _event$dataTransfer !== void 0 && _event$dataTransfer.getData(textMediaType))) {
    return null;
  }

  // Grab the first Text node and use that
  var text = Array.from(event.target.childNodes).find(function (node) {
    return node.nodeType === Node.TEXT_NODE;
  });
  return text !== null && text !== void 0 ? text : null;
}
var adapter = makeAdapter({
  typeKey: 'text-selection',
  // for text selection, we will usually be making a copy of the text
  defaultDropEffect: 'copy',
  mount: function mount(api) {
    // Binding to the `window` so that the element adapter has a
    // chance to get in first on the `document`.
    // We are giving preference to the element adapter.
    return bindAll(window, [{
      type: 'dragstart',
      listener: function listener(event) {
        // If the "dragstart" event is cancelled, then a drag won't start
        // There will be no further drag operation events (eg no "dragend" event)
        if (event.defaultPrevented) {
          return;
        }

        // Something has gone wrong with our drag event
        if (!event.dataTransfer) {
          // Including this code on "test" and "development" environments:
          // - Browser tests commonly run against "development" builds
          // - Unit tests commonly run in "test"
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.warn("\n                It appears as though you have are not testing DragEvents correctly.\n\n                - If you are unit testing, ensure you have polyfilled DragEvent.\n                - If you are browser testing, ensure you are dispatching drag events correctly.\n\n                Please see our testing guides for more information:\n                https://atlassian.design/components/pragmatic-drag-and-drop/core-package/testing\n              ".replace(/ {2}/g, ''));
          }
          return;
        }

        // Drag is being handled by the element adapter
        if (event.dataTransfer.types.includes(elementAdapterNativeDataKey)) {
          return;
        }

        // Something else is handling this drag
        if (!api.canStart(event)) {
          return;
        }
        var target = findTextNode(event);
        if (!target) {
          return;
        }
        var payload = {
          // The `Text` node that is the `target` is the `Text` node
          // that the user started the drag from.
          // The full text being dragged can be looked up from the `dataTransfer`.
          target: target,
          // This is safe to do in "dragstart" as the `dataTransfer` is in read/write mode.
          plain: event.dataTransfer.getData(textMediaType),
          HTML: event.dataTransfer.getData(HTMLMediaType)
        };
        api.start({
          event: event,
          dragType: {
            type: 'text-selection',
            startedFrom: 'internal',
            payload: payload
          }
        });
      }
    }]);
  }
});

// The `onGenerateDragPreview` does not make sense to publish for text selection
// as the browser is completely in control of the drag preview

export function dropTargetForTextSelection(args) {
  // note: not removing `onGenerateDragPreview`; just leaning on the type system
  return adapter.dropTarget(args);
}

// A shared single usage registration as any text can be dragged at any time
(function register() {
  // server side rendering check
  if (typeof window === 'undefined') {
    return;
  }
  adapter.registerUsage();
})();
export function monitorForTextSelection(args) {
  // note: not removing `onGenerateDragPreview`; just leaning on the type system
  return adapter.monitor(args);
}

/** Common event payload for all events */

/** A map containing payloads for all events */

/** Common event payload for all drop target events */

/** A map containing payloads for all events on drop targets */

/** Argument given to all feedback functions (eg `canDrop()`) on a `dropTargetForExternal` */

/** Argument given to all monitor feedback functions (eg `canMonitor()`) for a `monitorForExternal` */