/** Provide a function that you only ever want to be called a single time */
export function once(fn) {
  var cache = null;
  return function wrapped() {
    if (!cache) {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }
      var result = fn.apply(this, args);
      cache = {
        result: result
      };
    }
    return cache.result;
  };
}