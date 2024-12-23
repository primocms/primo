import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _objectWithoutProperties from "@babel/runtime/helpers/objectWithoutProperties";
var _excluded = ["block"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
// using a symbol so we can guarantee a key with a unique value
var uniqueKey = Symbol('tree-item-instruction');
function getCenter(rect) {
  return {
    x: (rect.right + rect.left) / 2,
    y: (rect.bottom + rect.top) / 2
  };
}
function standardHitbox(_ref) {
  var client = _ref.client,
    borderBox = _ref.borderBox;
  var quarterOfHeight = borderBox.height / 4;

  // In the top 1/4: reorder-above
  // On the line = in the top 1/4 to give this zone a bit more space
  if (client.y <= borderBox.top + quarterOfHeight) {
    return 'reorder-above';
  }
  // In the bottom 1/4: reorder-below
  // On the line = in the bottom 1/4 to give this zone a bit more space
  if (client.y >= borderBox.bottom - quarterOfHeight) {
    return 'reorder-below';
  }
  return 'make-child';
}
function getInstruction(_ref2) {
  var element = _ref2.element,
    input = _ref2.input,
    currentLevel = _ref2.currentLevel,
    indentPerLevel = _ref2.indentPerLevel,
    mode = _ref2.mode;
  var client = {
    x: input.clientX,
    y: input.clientY
  };
  var borderBox = element.getBoundingClientRect();
  if (mode === 'standard') {
    var type = standardHitbox({
      borderBox: borderBox,
      client: client
    });
    return {
      type: type,
      indentPerLevel: indentPerLevel,
      currentLevel: currentLevel
    };
  }
  var center = getCenter(borderBox);
  if (mode === 'expanded') {
    // leveraging "standard" hitbox to ensure that the 'reorder-above' hit zone is
    // exactly the same for "standard" and "expanded" items
    var _type = standardHitbox({
      borderBox: borderBox,
      client: client
    });
    return {
      // Use the "standard" hitbox for "reorder above",
      // The rest of the item is "make-child"
      type: _type === 'reorder-above' ? _type : 'make-child',
      indentPerLevel: indentPerLevel,
      currentLevel: currentLevel
    };
  }

  // `mode` is "last-in-group"

  var visibleInset = indentPerLevel * currentLevel;

  // Before the left edge of the visible item
  if (client.x < borderBox.left + visibleInset) {
    // Above the center: `reorder-above`
    if (client.y < center.y) {
      return {
        type: 'reorder-above',
        indentPerLevel: indentPerLevel,
        currentLevel: currentLevel
      };
    }
    // On or below the center: `reparent`
    // On the center = `reparent` as we are giving a slightly bigger hitbox to this
    // action as it is the only place a user can do it
    var rawLevel = (client.x - borderBox.left) / indentPerLevel;
    // We can get sub pixel negative numbers as getBoundingClientRect gives sub-pixel accuracy,
    // where as clientX is rounded to the nearest pixel.
    // Using Math.max() ensures we can never get a negative level
    var desiredLevel = Math.max(Math.floor(rawLevel), 0);
    return {
      type: 'reparent',
      desiredLevel: desiredLevel,
      indentPerLevel: indentPerLevel,
      currentLevel: currentLevel
    };
  }
  // On the visible item
  return {
    type: standardHitbox({
      borderBox: borderBox,
      client: client
    }),
    indentPerLevel: indentPerLevel,
    currentLevel: currentLevel
  };
}
function isShallowEqual(a, b) {
  var aKeys = Object.keys(a).sort();
  var bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every(function (key) {
    return a[key] === b[key];
  });
}
function areInstructionsEqual(a, b) {
  // Shortcut
  if (a.type !== b.type) {
    return false;
  }
  if (a.type === 'instruction-blocked' && b.type === 'instruction-blocked') {
    return areInstructionsEqual(a.desired, b.desired);
  }
  return isShallowEqual(a, b);
}

// Note: not using `memoize-one` as all we need is a cached value.
// We do not need to avoid executing an expensive function.
var memoizeInstruction = function () {
  var last = null;
  return function (instruction) {
    if (last && areInstructionsEqual(last, instruction)) {
      return last;
    }
    last = instruction;
    return instruction;
  };
}();
function applyInstructionBlock(_ref3) {
  var desired = _ref3.desired,
    block = _ref3.block;
  if (block !== null && block !== void 0 && block.includes(desired.type) && desired.type !== 'instruction-blocked') {
    var blocked = {
      type: 'instruction-blocked',
      desired: desired
    };
    return blocked;
  }
  return desired;
}
export function attachInstruction(userData, _ref4) {
  var block = _ref4.block,
    rest = _objectWithoutProperties(_ref4, _excluded);
  var desired = getInstruction(rest);
  var withBlock = applyInstructionBlock({
    desired: desired,
    block: block
  });
  var memoized = memoizeInstruction(withBlock);
  return _objectSpread(_objectSpread({}, userData), {}, _defineProperty({}, uniqueKey, memoized));
}
export function extractInstruction(userData) {
  var _ref5;
  return (_ref5 = userData[uniqueKey]) !== null && _ref5 !== void 0 ? _ref5 : null;
}