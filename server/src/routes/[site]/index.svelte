<!-- Empty on purpose -->
<script context="module">
  // this is a workaround for a sveltekit bug where newly-created links weren't being handled correctly (i.e. reloading the page)
  // a few seconds after mounting, causing an issue where newly-created pages would reload the site (and lose progress) if clicked immediately after creation
	/** @type {import('@sveltejs/kit').Load} */
	export async function load({ params }) {
		return {
			redirect: `/${params.site}/index`, // load [site]/[...page].svelte
      status: 300
		};
	}
</script>