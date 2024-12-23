/** Any valid CSS string value
 * @example `calc(var(--grid) * 2)
 */

/**
 * Position the native drag preview outside of the users pointer
 */
export function pointerOutsideOfPreview(point) {
  return function (_ref) {
    var container = _ref.container;
    // Only reliable cross browser technique found to push a
    // drag preview away from the cursor is to use transparent borders on the container
    Object.assign(container.style, {
      borderLeft: "".concat(point.x, " solid transparent"),
      borderTop: "".concat(point.y, " solid transparent")
    });
    return {
      x: 0,
      y: 0
    };
  };
}