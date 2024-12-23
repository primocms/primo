/**
 * Will return `true` when any native predicate function returns `true`.
 * Using the name `"some"` for consistency with `Array.prototype.some`.\
 *
 * @example
 *
 * ```ts
 * monitorForNative({
 *  // enable monitor when dragging files or text
 *  canMonitor: some(containsFiles, containsText),
 * });
 *
 * monitorForNative({
 *  // enable monitor when dragging external files or internal text
 *  canMonitor: some(external(containsFiles), internal(containsText)),
 * });
 * ```
 */
export function some() {
  for (var _len = arguments.length, predicates = new Array(_len), _key = 0; _key < _len; _key++) {
    predicates[_key] = arguments[_key];
  }
  return function combined(payload) {
    return predicates.some(function (fn) {
      return fn(payload);
    });
  };
}