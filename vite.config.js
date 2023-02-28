import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	server: {
    fs: {
      // throws an error without this when importing Fira font
      allow: ['..', 'node_modules/@fontsource/fira-code']
    },
    proxy: {},
    port: 5174,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  },
  define: {
    '__SERVER_VERSION__': JSON.stringify(process.env.npm_package_version),
  }
};

export default config;
