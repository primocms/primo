import preprocess from 'svelte-preprocess';
import adapter from '@sveltejs/adapter-static';
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import nested from 'postcss-nested'
import preset from 'postcss-preset-env'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://github.com/sveltejs/svelte-preprocess
	// for more information about preprocessors
  preprocess: [
    preprocess({
      postcss: {
        plugins: [tailwindcss(), autoprefixer(), nested(), preset()],
      },
    }),
  ],
	kit: {
		adapter: adapter({
      fallback: 'index.html'
    })
	},
  vitePlugin: {
		experimental: {
			inspector: true,
		}
	},
};

export default config;
