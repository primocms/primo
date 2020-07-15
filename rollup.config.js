import svelte from 'rollup-plugin-svelte'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import livereload from 'rollup-plugin-livereload'
import { terser } from 'rollup-plugin-terser'
import autoPreprocess from 'svelte-preprocess'
import typescript from '@rollup/plugin-typescript'
import css from 'rollup-plugin-css-only'

const rimraf = require('rimraf')

const production = !process.env.ROLLUP_WATCH

function onwarn(warning, handler) {
  if (warning.code === 'CIRCULAR_DEPENDENCY') return // should probably revisit this at some point
  if (warning.message === 'A11y: Avoid using autofocus') return // use responsibly
  if (warning.message === 'A11y: avoid tabindex values above zero') return // remove if possible
  if (warning.message === 'A11y: <a> element should have an href attribute')
    return // remove asap
  handler(warning)
}

const preprocess = autoPreprocess({
  preserve: ['systemjs-importmap'],
  postcss: {
    plugins: [
      require('postcss-nested'),
      require('tailwindcss')('./tailwind.config.js'),
    ],
  },
})

export default {
  input: 'src/main.js',
  output: {
    sourcemap: true,
    // file: 'run/public/bundle.js',
    file: 'public/bundle.js',
    format: 'iife',
    inlineDynamicImports: true,
    name: 'app',
    // sourcemap: true,
    // format: 'esm',
    // dir: 'public/build',
  },
  plugins: [
    rimraf('./public/build', () => {
      console.log('public/build removed')
    }),
    css({ output: 'public/bundle.css' }),
    svelte({ preprocess, customElement: true, include: /\.wc\.svelte$/ }),
    svelte({
      customElement: false,
      exclude: /\.wc\.svelte$/,
      preprocess,
      // enable run-time checks when not in production
      dev: !production,
      // we'll extract any component CSS out into
      // a separate file - better for performance
      css: (css) => {
        css.write('public/build/bundle.css')
      },
    }),

    // babel(babelrc()),

    // If you have external dependencies installed from
    // npm, you'll most likely need these plugins. In
    // some cases you'll need additional configuration -
    // consult the documentation for details:
    // https://github.com/rollup/plugins/tree/master/packages/commonjs
    resolve({
      browser: true,
      dedupe: ['svelte'],
    }),
    commonjs(),
    typescript(), // <-- added below commonjs

    // In dev mode, call `npm run start` once
    // the bundle has been generated
    !production && serve(),

    // Watch the `public` directory and refresh the
    // browser on changes when not in production
    !production && livereload('public'),

    // If we're building for production (npm run build
    // instead of npm run dev), minify
    production && terser(),
  ],
  watch: {
    clearScreen: false,
  },
  onwarn,
}

function serve() {
  let started = false

  return {
    writeBundle() {
      if (!started) {
        started = true

        require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
          stdio: ['ignore', 'inherit', 'inherit'],
          shell: true,
        })
      }
    },
  }
}
