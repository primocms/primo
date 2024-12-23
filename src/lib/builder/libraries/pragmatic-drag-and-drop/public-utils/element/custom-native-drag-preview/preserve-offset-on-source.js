export function preserveOffsetOnSource(_ref) {
  var element = _ref.element,
    input = _ref.input;
  return function (_ref2) {
    var container = _ref2.container;
    var sourceRect = element.getBoundingClientRect();
    var containerRect = container.getBoundingClientRect();
    var offsetX = Math.min(
    // difference
    input.clientX - sourceRect.x,
    // don't let the difference be more than the width of the container,
    // otherwise the pointer will be off the preview
    containerRect.width);
    var offsetY = Math.min(
    // difference
    input.clientY - sourceRect.y,
    // don't let the difference be more than the height of the container,
    // otherwise the pointer will be off the preview
    containerRect.height);
    return {
      x: offsetX,
      y: offsetY
    };
  };
}