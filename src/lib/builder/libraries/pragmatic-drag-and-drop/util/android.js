import { cacheFirst } from './cache-first';

// using `cache` as our `isAndroid()` result will not change in a browser
export var isAndroid = cacheFirst(function isAndroid() {
  return navigator.userAgent.toLocaleLowerCase().includes('android');
});
export var androidFallbackText = 'pdnd:android-fallback';