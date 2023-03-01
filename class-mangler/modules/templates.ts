import { escapeClassName, getRandomClassName, getRegexps } from '../utils';

export default function transformTemplates(
  id: string,
  code: string,
  classMapping: Map<string, string>,
  config: GeneratorConfig
) {
  const rawClasses = getRawClasses(id, code);

  const unqiueClasses = new Set(
    rawClasses
      .map((c) => c.split(' '))
      .flat()
      .filter((c) => c.length > 0)
      .sort((a, b) => b.length - a.length)
  );

  unqiueClasses.forEach((className) => {
    if (!classMapping.has(className)) {
      let random = getRandomClassName(config);
      const classMappingList = Array.from(classMapping.values());

      while (classMappingList.includes(random)) {
        random = getRandomClassName(config);
      }

      classMapping.set(className, random);
    }
  });

  const rawClassesMap = new Map();

  rawClasses.forEach((classNames) => {
    const randomClassNames = classNames
      .split(' ')
      .map((className) => {
        if (classMapping.has(className)) {
          return classMapping.get(className);
        }
      })
      .join(' ');

    rawClassesMap.set(classNames, randomClassNames);
  });

  rawClasses
    .sort((a, b) => b.length - a.length)
    .forEach((classNames) => {
      let match: RegExpExecArray;
      const regex = new RegExp(`(?<="class",.*?)${escapeClassName(classNames)}(?=[\\s"')])`, 'g');
      while ((match = regex.exec(code)) !== null) {
        if (match.index > 0 && code[match.index - 2] === ',') {
          code = code.replace(match[0], `"${rawClassesMap.get(classNames)}"`);
        } else {
          code = code.replace(match[0], `${rawClassesMap.get(classNames)}`);
        }
      }
    });

  return {
    code,
    map: null
  };
}

const getRawClasses = (id: string, code: string) => {
  const rawClasses: string[] = [];
  const regexps = getRegexps(id);

  regexps.forEach((regex) => {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(code)) !== null) {
      rawClasses.push(match[0]);
    }
  });

  return rawClasses;
};
