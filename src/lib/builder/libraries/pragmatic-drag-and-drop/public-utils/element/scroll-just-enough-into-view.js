/**
 * Scroll an `element` just enough into view so that the element becomes totally visible.
 * If the element is already totally visible then no scrolling will occur.
 */
export function scrollJustEnoughIntoView(_ref) {
  var element = _ref.element;
  element.scrollIntoView({
    block: 'nearest',
    inline: 'nearest'
  });
}