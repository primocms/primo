import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
const config = {
  plugins: [sveltekit()],
  server: {
    fs: {
      // throws an error without this when importing Fira font
      allow: ['..', 'node_modules/@fontsource/fira-code']
    }
  },
  define: {
    '__SERVER_VERSION__': JSON.stringify(process.env.npm_package_version),
  }
};

export default config;