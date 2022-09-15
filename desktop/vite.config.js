import { sveltekit } from '@sveltejs/kit/vite';

export default {
  plugins: [sveltekit()],
  server: {
    fs: {
      // throws an error without this when importing Fira font
      allow: ['..', 'node_modules/@fontsource/fira-code']
    },
    open: false, // do not open the browser as we use electron
    port: process.env.PORT || 5173,
  },
  optimizeDeps: {
    force: true
  },
  build: {
    sourcemap: true,
  },
  define: {
      '__DESKTOP_VERSION__': JSON.stringify(process.env.npm_package_version),
  }
}