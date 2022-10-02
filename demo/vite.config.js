import { sveltekit } from '@sveltejs/kit/vite';

export default {
  plugins: [sveltekit()],
  server: {
    fs: {
      // throws an error without this when importing Fira font
      allow: ['..', 'node_modules/@fontsource/fira-code']
    },
    port: 5174
  },
  define: {
    __DESKTOP_VERSION__: JSON.stringify(process.env.npm_package_version)
  },
  test: {
    // ...
  }
}