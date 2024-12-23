import { HTMLMediaType } from '../../util/media-types/html-media-type';
export function containsHTML(_ref) {
  var source = _ref.source;
  return source.types.includes(HTMLMediaType);
}
export function getHTML(_ref2) {
  var source = _ref2.source;
  return source.getStringData(HTMLMediaType);
}