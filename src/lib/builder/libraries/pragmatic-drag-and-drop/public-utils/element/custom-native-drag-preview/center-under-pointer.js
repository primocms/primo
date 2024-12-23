export var centerUnderPointer = function centerUnderPointer(_ref) {
  var container = _ref.container;
  var rect = container.getBoundingClientRect();
  return {
    x: rect.width / 2,
    y: rect.height / 2
  };
};