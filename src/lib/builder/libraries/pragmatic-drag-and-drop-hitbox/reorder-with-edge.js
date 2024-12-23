import { reorder } from '@atlaskit/pragmatic-drag-and-drop/reorder';
import { getReorderDestinationIndex } from './get-reorder-destination-index';
export function reorderWithEdge(_ref) {
  var list = _ref.list,
    startIndex = _ref.startIndex,
    closestEdgeOfTarget = _ref.closestEdgeOfTarget,
    indexOfTarget = _ref.indexOfTarget,
    axis = _ref.axis;
  return reorder({
    list: list,
    startIndex: startIndex,
    finishIndex: getReorderDestinationIndex({
      closestEdgeOfTarget: closestEdgeOfTarget,
      startIndex: startIndex,
      indexOfTarget: indexOfTarget,
      axis: axis
    })
  });
}