import { urlMediaType } from '../../util/media-types/url-media-type';
export function containsURLs(_ref) {
  var source = _ref.source;
  return source.types.includes(urlMediaType);
}
export function getURLs(_ref2) {
  var source = _ref2.source;
  var value = source.getStringData(urlMediaType);

  // no values found
  if (value == null) {
    return [];
  }
  var urls = value
  // You can have multiple urls split by CR+LF (EOL)
  // - CR: Carriage Return '\r'
  // - LF: Line Feed '\n'
  // - EOL: End of Line '\r\n'
  .split('\r\n')
  // a uri-list can have comment lines starting with '#'
  // so we need to remove those
  .filter(function (piece) {
    return !piece.startsWith('#');
  });
  return urls;
}