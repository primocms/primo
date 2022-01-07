import preprocess from 'svelte-preprocess';
import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess({
    postcss: true
  }),
	kit: {
		adapter: adapter({
      fallback: 'index.html'
    }),
    router: true,
		// hydrate the <div id="svelte"> element in src/app.html
		target: '#svelte',
    vite: {
      server: {
        fs: {
          // throws an error without this when importing Fira font
          allow: ['..', 'node_modules/@fontsource/fira-code']
        },
        force: true,
        open: false, // do not open the browser as we use electron
        port: process.env.PORT || 3333,
      },
      build: {
        sourcemap: true,
      },
      define: {
          '__DESKTOP_VERSION__': JSON.stringify(process.env.npm_package_version),
      }
    }
	}
};

export default config;
