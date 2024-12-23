import _defineProperty from "@babel/runtime/helpers/defineProperty";
function _createForOfIteratorHelper(o, allowArrayLike) { var it = typeof Symbol !== "undefined" && o[Symbol.iterator] || o["@@iterator"]; if (!it) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = it.call(o); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it.return != null) it.return(); } finally { if (didErr) throw err; } } }; }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
export function makeMonitor() {
  var registry = new Set();
  var dragging = null;
  function tryAddToActive(monitor) {
    if (!dragging) {
      return;
    }
    // Monitor is allowed to monitor events if:
    // 1. It has no `canMonitor` function (default is that a monitor can listen to everything)
    // 2. `canMonitor` returns true
    if (!monitor.canMonitor || monitor.canMonitor(dragging.canMonitorArgs)) {
      dragging.active.add(monitor);
    }
  }
  function monitorForConsumers(args) {
    // We are giving each `args` a new reference so that you
    // can create multiple monitors with the same `args`.
    var entry = _objectSpread({}, args);
    registry.add(entry);

    // if there is an active drag we need to see if this new monitor is relevant
    tryAddToActive(entry);
    return function cleanup() {
      registry.delete(entry);

      // We need to stop publishing events during a drag to this monitor!
      if (dragging) {
        dragging.active.delete(entry);
      }
    };
  }
  function dispatchEvent(_ref) {
    var eventName = _ref.eventName,
      payload = _ref.payload;
    if (eventName === 'onGenerateDragPreview') {
      dragging = {
        canMonitorArgs: {
          initial: payload.location.initial,
          source: payload.source
        },
        active: new Set()
      };
      var _iterator = _createForOfIteratorHelper(registry),
        _step;
      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var monitor = _step.value;
          tryAddToActive(monitor);
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }
    }

    // This should never happen.
    if (!dragging) {
      return;
    }

    // Creating an array from the set _before_ iterating
    // This is so that monitors added during the current event will not be called.
    // This behaviour matches native EventTargets where an event listener
    // cannot add another event listener during an active event to the same
    // event target in the same event (for us we have a single global event target)
    var active = Array.from(dragging.active);
    for (var _i = 0, _active = active; _i < _active.length; _i++) {
      var _monitor = _active[_i];
      // A monitor can be removed by another monitor during an event.
      // We need to check that the monitor is still registered before calling it
      if (dragging.active.has(_monitor)) {
        var _monitor$eventName;
        // @ts-expect-error: I cannot get this type working!
        (_monitor$eventName = _monitor[eventName]) === null || _monitor$eventName === void 0 || _monitor$eventName.call(_monitor, payload);
      }
    }
    if (eventName === 'onDrop') {
      dragging.active.clear();
      dragging = null;
    }
  }
  return {
    dispatchEvent: dispatchEvent,
    monitorForConsumers: monitorForConsumers
  };
}