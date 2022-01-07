import preprocess from 'svelte-preprocess';
// import adapter from '@sveltejs/adapter-static';
import vercel from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
	preprocess: preprocess({
    postcss: true
  }),
	kit: {
		adapter: vercel(),
    // ssr: false,
		// hydrate the <div id="svelte"> element in src/app.html
		target: '#svelte',
    vite: {
      server: {
        fs: {
          // throws an error without this when importing Fira font
          allow: ['..', 'node_modules/@fontsource/fira-code']
        }
      },
      define: {
        '__SERVER_VERSION__': JSON.stringify(process.env.npm_package_version),
      }
    }
	}
};

export default config;
