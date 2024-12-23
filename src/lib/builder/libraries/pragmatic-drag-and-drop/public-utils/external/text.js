import { textMediaType } from '../../util/media-types/text-media-type';
export function containsText(_ref) {
  var source = _ref.source;
  return source.types.includes(textMediaType);
}

/* Get the plain text that a user is dragging */
export function getText(_ref2) {
  var source = _ref2.source;
  return source.getStringData(textMediaType);
}