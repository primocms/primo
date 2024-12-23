// Extending `Map` to allow us to link Key and Values together

var ledger = new Map();
function registerUsage(_ref) {
  var typeKey = _ref.typeKey,
    mount = _ref.mount;
  var entry = ledger.get(typeKey);
  if (entry) {
    entry.usageCount++;
    return entry;
  }
  var initial = {
    typeKey: typeKey,
    unmount: mount(),
    usageCount: 1
  };
  ledger.set(typeKey, initial);
  return initial;
}
export function register(args) {
  var entry = registerUsage(args);
  return function unregister() {
    entry.usageCount--;
    if (entry.usageCount > 0) {
      return;
    }
    // Only a single usage left, remove it
    entry.unmount();
    ledger.delete(args.typeKey);
  };
}