import preprocess from 'svelte-preprocess';
// import adapter from '@sveltejs/adapter-static';
import adapter from '@sveltejs/adapter-auto';

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
		adapter: adapter(),
    // ssr: false,
	}
};

export default config;
