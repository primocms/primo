import { defineConfig } from 'vite'
import svelte from '@sveltejs/vite-plugin-svelte'
import preprocess from 'svelte-preprocess';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte({ preprocess: preprocess({ postcss: true }) })],
  build: {
    sourcemap: true,
    lib: {
      entry: require('path').resolve(__dirname, 'src/index.js'),
      name: 'MyLib',
      formats: ['es']
    },
  }
})
