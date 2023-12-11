import { sveltekit } from '@sveltejs/kit/vite';

/** @type {import('vite').UserConfig} */
const config = {
	plugins: [
    sveltekit(),
    // ClassMangler({
    //   // dev: true
    // }),
    // workaround for a bug in vite-plugin-ssr
    {
      name: 'remove-manifest',
      configResolved(c) {
        const manifestPlugin = c.worker.plugins.findIndex((p) => p.name === 'vite:manifest');
        c.worker.plugins.splice(manifestPlugin, 1);
        const ssrManifestPlugin = c.worker.plugins.findIndex(
          (p) => p.name === 'vite:ssr-manifest'
        );
        c.plugins.splice(ssrManifestPlugin, 1);
      },
      apply: 'build', // or 'serve'
    }
  ],
  build: {
    sourcemap: true
  },
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	server: {
    fs: {
      // throws an error without this when importing Fira font
      allow: ['..', 'node_modules/@fontsource/fira-code']
    },
    // port: 5174,
    // headers: {
    //   'Access-Control-Allow-Origin': '*',
    //   'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
    //   'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    // }
  },
  define: {
    '__SERVER_VERSION__': JSON.stringify(process.env.npm_package_version),
  }
};

export default config;
