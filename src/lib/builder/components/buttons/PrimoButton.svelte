<script>
	import { ArrowLeft } from 'lucide-svelte'
	import { loadingSite } from '../../stores/app/misc'
	import UI from '../../ui'

	function get_sites_url() {
		if (typeof window === 'undefined') return '/admin/dashboard/sites'
		const { protocol, hostname, port } = window.location
		if (hostname.endsWith('.localhost')) {
			return `${protocol}//localhost${port ? `:${port}` : ''}/admin/dashboard/sites`
		}
		return '/admin/dashboard/sites'
	}
</script>

<a class="sites-link" href={get_sites_url()}>
	{#if $loadingSite}<UI.Spinner />{:else}<ArrowLeft size={14} aria-hidden="true" />{/if}
	<span>Sites</span>
</a>
<span class="navigation-divider" aria-hidden="true"></span>

<style>
	.sites-link { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; padding: 7px 8px; border-radius: 4px; color: #b5b5bd; font-size: 12px; font-weight: 400; text-decoration: none; }
	.sites-link:hover { color: #f4f4f5; background: #ffffff08; }
	.sites-link:focus-visible { outline: 2px solid #956e51; outline-offset: 2px; }
	.navigation-divider { flex-shrink: 0; height: 20px; width: 1px; background: #343437; margin-inline: 3px; }
</style>
