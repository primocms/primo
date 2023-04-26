import { cssPseudoRegex, escapeClassName } from '../utils';

export default function transformStyles(code, classMapping: Map<string, string>) {
  let classesToReplace = [];

  classMapping.forEach((randomClassName, className) => {
    classesToReplace = [
      ...classesToReplace,
      {
        raw: className,
        random: randomClassName,
        escaped: escapeClassName(className)
      }
    ];
  });

  classesToReplace.forEach((classToReplace) => {
    const regex = new RegExp(
      `\\.(?:${classToReplace.escaped})(?=[\\w\\d .:{]+)((?::(?:${cssPseudoRegex}))*(?:[(\\w\\d )]*))`,
      'gm'
    );
    code = code.replace(regex, '.' + classToReplace.random + '$1');
  });

  return {
    code,
    map: null
  };
}
