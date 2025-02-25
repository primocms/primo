/**
 * Create a new function that will cache the result of it's first call forever.
 * This is similar to `memoize-one`, except the cache for `memoize-one` can be
 * updated if the arguments change.
 *
 * @example
 * function sayHello(name: string): string {
 *   return `Hello ${name}`;
 * }
 * const cached = cacheFirst(sayHello);
 *
 * cached('Alex');
 * cached('Declan'); // original result of `sayHello` call is returned
 */
export function cacheFirst(fn) {
  var result = null;
  return function single() {
    if (!result) {
      result = {
        value: fn.apply(void 0, arguments)
      };
    }
    return result.value;
  };
}