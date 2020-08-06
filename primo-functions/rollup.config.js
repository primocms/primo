import json from '@rollup/plugin-json';
import builtins from 'rollup-plugin-node-builtins';
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import { terser } from 'rollup-plugin-terser'

const fs = require('fs')

const production = !process.env.ROLLUP_WATCH

function onwarn(warning, handler) {
  if (warning.code === 'CIRCULAR_DEPENDENCY') return // should probably revisit this at some point
  if (warning.message === 'A11y: Avoid using autofocus') return // use responsibly
  if (warning.message === 'A11y: avoid tabindex values above zero') return // remove if possible
  if (warning.message === 'A11y: <a> element should have an href attribute')
    return // remove asap
  handler(warning)
}

export default {
  input: 'index.js',
  output: {
    name: 'app',
    exports: 'named',
    // sourcemap: true,
    file: 'dist/index.js',
    format: 'cjs',
    // inlineDynamicImports: true,
    // sourcemap: true,
    // format: 'esm',
    // dir: 'dist',
  },
  plugins: [
    json(),
    builtins(),

    // babel(babelrc()),

    // If you have external dependencies installed from
    // npm, you'll most likely need these plugins. In
    // some cases you'll need additional configuration -
    // consult the documentation for details:
    // https://github.com/rollup/plugins/tree/master/packages/commonjs
    resolve({
      browser: false,
      dedupe: ['svelte'],
    }),
    commonjs(),
    // typescript(), // <-- added below commonjs

    // If we're building for production (npm run build
    // instead of npm run dev), minify
    production && terser(),
  ],
  external: builtins,
  watch: {
    clearScreen: false,
  },
  onwarn,
}
