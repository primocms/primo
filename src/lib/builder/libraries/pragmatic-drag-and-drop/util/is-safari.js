import { cacheFirst } from './cache-first';

// using `cache` as our `isSafari()` result will not change in a browser

/**
 * Returns `true` if a `Safari` browser.
 * Returns `true` if the browser is running on iOS (they are all Safari).
 * */
export var isSafari = cacheFirst(function isSafari() {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
  var _navigator = navigator,
    userAgent = _navigator.userAgent;
  return userAgent.includes('AppleWebKit') && !userAgent.includes('Chrome');
});