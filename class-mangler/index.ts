import type { Plugin } from 'vite';
import transformStyles from './modules/styles';
import transformTemplates from './modules/templates';
import { endsWith } from './utils';

const defaultSuffixes = ['.svelte', '.html', '.vue', '.jsx', '.tsx'];

export default function ClassMangler(config: PluginConfig = {}): Plugin[] {
  config.suffixes = config.suffixes || defaultSuffixes;

  const classMapping = new Map();

  const plugins: Plugin[] = [
    {
      name: 'class-mangler-templates',
      apply: config.dev ? 'serve' : 'build',
      enforce: 'pre',
      transform(code, id) {
        if (endsWith(id, config.suffixes)) {
          return transformTemplates(id, code, classMapping, config);
        }
      }
    },
    {
      name: 'class-mangler-styles',
      apply: config.dev ? 'serve' : 'build',
      transform(code, id) {
        if (endsWith(id, ['.css'])) {
          return transformStyles(code, classMapping);
        }
      },
      generateBundle() {
        const classMappingObject = {};

        classMapping.forEach((value, key) => {
          classMappingObject[key] = value;
        });

        this.emitFile({
          type: 'asset',
          name: 'class-mapping.json',
          source: JSON.stringify(classMappingObject)
        });
      }
    }
  ];

  if (config.dev) {
    plugins.forEach((plugin) => {
      delete plugin.apply;
    });
  }

  return plugins;
}
