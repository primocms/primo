import _slicedToArray from "@babel/runtime/helpers/slicedToArray";
/**
 * Reorder a provided `list`
 * Returns a new array and does not modify the original array
 */
export function reorder(_ref) {
  var list = _ref.list,
    startIndex = _ref.startIndex,
    finishIndex = _ref.finishIndex;
  if (startIndex === -1 || finishIndex === -1) {
    return list;
  }
  var result = Array.from(list);
  var _result$splice = result.splice(startIndex, 1),
    _result$splice2 = _slicedToArray(_result$splice, 1),
    removed = _result$splice2[0];
  result.splice(finishIndex, 0, removed);
  return result;
}