import random from 'randomstring';
import Crypto from 'crypto';

export const cssPseudo = [
  'active',
  'checked',
  'disabled',
  'empty',
  'enabled',
  'first-child',
  'first-of-type',
  'focus',
  'hover',
  'in-range',
  'invalid',
  'lang',
  'last-child',
  'last-of-type',
  'link',
  'not',
  'nth-child',
  'nth-last-child',
  'nth-last-of-type',
  'nth-of-type',
  'only-of-type',
  'only-child',
  'optional',
  'out-of-range',
  'read-only',
  'read-write',
  'required',
  'root',
  'target',
  'valid',
  'visited'
];

export const cssPseudoRegex = cssPseudo.join('|');

export const escapeClassName = (className: string) => {
  return className.replace(/[/\\^$*+?.()|[\]{}:]/g, '\\\\$&');
};

export const removeCssPsuedoSelector = (code: string) => {
  return code.replace(new RegExp(`:(${cssPseudoRegex})[(\\w\\d)]*`, 'g'), '');
};

export const getRandomClassName = (config: { length?: number; min?: number; max?: number }) => {
  let length = 5;

  config.length
    ? (length = config.length)
    : config.min && config.max && (length = getRandomInt(config.min, config.max));

  return random.generate({
    length,
    charset: 'alphabetic'
  });
};

const getRandomInt = (min: number, max: number) => {
  return (Crypto.randomBytes(1)[0] % (max - min + 1)) + min;
};

export const endsWith = (id: string, suffixes: string[]) => {
  return suffixes.some((suffix) => {
    return id.endsWith(suffix);
  });
};

export const getFiletype = (id: string) => {
  const res = id.match(new RegExp('[^\\.]+$'));
  return res ? res[0] : '';
};

export const getRegexps = (id: string) => {
  const arr: RegExp[] = [];
  switch (getFiletype(id)) {
    case 'svelte':
      arr.push(new RegExp('(?<=class["\'],\\s*["\']).*?(?=["\'])', 'gm'));
      break;
  }
  return arr;
};
