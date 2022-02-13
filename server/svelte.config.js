import preprocess from 'svelte-preprocess';
// import adapter from '@sveltejs/adapter-static';
import vercel from '@sveltejs/adapter-vercel';

const IGNORED_WARNINGS = [`'__SERVER_VERSION__' is not defined`];

/** @type {import('@sveltejs/kit').Config} */
const config = {
	onwarn: (warning, handler) => {
		if (!IGNORED_WARNINGS.includes(warning.message)) handler(warning);
	},
	preprocess: preprocess({
    postcss: true
  }),
	kit: {
		adapter: vercel(),
    // ssr: false,
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
