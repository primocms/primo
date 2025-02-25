import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
// re-exporting type to make it easy to use

var getDistanceToEdge = {
  top: function top(rect, client) {
    return Math.abs(client.y - rect.top);
  },
  right: function right(rect, client) {
    return Math.abs(rect.right - client.x);
  },
  bottom: function bottom(rect, client) {
    return Math.abs(rect.bottom - client.y);
  },
  left: function left(rect, client) {
    return Math.abs(client.x - rect.left);
  }
};

// using a symbol so we can guarantee a key with a unique value
var uniqueKey = Symbol('closestEdge');

/**
 * Adds a unique `Symbol` to the `userData` object. Use with `extractClosestEdge()` for type safe lookups.
 */
export function attachClosestEdge(userData, _ref) {
  var _entries$sort$0$edge, _entries$sort$;
  var element = _ref.element,
    input = _ref.input,
    allowedEdges = _ref.allowedEdges;
  var client = {
    x: input.clientX,
    y: input.clientY
  };
  // I tried caching the result of `getBoundingClientRect()` for a single
  // frame in order to improve performance.
  // However, on measurement I saw no improvement. So no longer caching
  var rect = element.getBoundingClientRect();
  var entries = allowedEdges.map(function (edge) {
    return {
      edge: edge,
      value: getDistanceToEdge[edge](rect, client)
    };
  });

  // edge can be `null` when `allowedEdges` is []
  var addClosestEdge = (_entries$sort$0$edge = (_entries$sort$ = entries.sort(function (a, b) {
    return a.value - b.value;
  })[0]) === null || _entries$sort$ === void 0 ? void 0 : _entries$sort$.edge) !== null && _entries$sort$0$edge !== void 0 ? _entries$sort$0$edge : null;
  return _objectSpread(_objectSpread({}, userData), {}, _defineProperty({}, uniqueKey, addClosestEdge));
}

/**
 * Returns the value added by `attachClosestEdge()` to the `userData` object. It will return `null` if there is no value.
 */
export function extractClosestEdge(userData) {
  var _ref2;
  return (_ref2 = userData[uniqueKey]) !== null && _ref2 !== void 0 ? _ref2 : null;
}