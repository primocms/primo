<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import { Input } from '$lib/components/ui/input'
	import { Button } from '$lib/components/ui/button'
	import { Copy, Check, Loader } from 'lucide-svelte'
	import { self } from '$lib/pocketbase/managers'
	import { is_host_assigned } from '$lib/site_host'
	import type { Site } from '$lib/common/models/Site'

	// Reusable connect-a-domain flow. The server-side domain provider (Railway
	// in hosted mode, manual otherwise) attaches the host and returns the DNS
	// records the user must create; we poll until the cert is live. Uniqueness +
	// validation are enforced server-side. Used from the dashboard and the
	// editor's publish dialog.
	type DnsRecord = { type: string; host: string; value: string; status: string; purpose: string }

	let {
		site,
		open = $bindable(false),
		onconnected
	}: {
		site: Pick<Site, 'id' | 'host' | 'domain_status' | 'domain_dns_records'> | null | undefined
		open?: boolean
		onconnected?: () => void
	} = $props()

	let new_site_host = $state('')
	let error = $state('')
	let connecting = $state(false)
	let domain_status = $state('')
	let domain_records: DnsRecord[] = $state([])
	let copied_dns: string | null = $state(null)
	let poll_timer: ReturnType<typeof setTimeout> | null = null
	// The host the shown records/status belong to. Lets us tell "still checking
	// the attached domain" (→ Refresh) from "typed a new domain" (→ Connect).
	let attached_host = $state('')

	$effect(() => {
		if (site) {
			const assigned = is_host_assigned(site) ? site.host : ''
			new_site_host = assigned
			attached_host = assigned
			domain_status = site.domain_status || ''
			domain_records = parse_dns_records(site.domain_dns_records)
		}
	})

	// True once a domain is attached and we're still waiting for it to go live,
	// and the user hasn't changed the input to a different domain. In this state
	// the primary action is to re-check status, not re-attach (which errors).
	const awaiting = $derived(
		domain_records.length > 0 && domain_status !== 'live' && new_site_host.trim().toLowerCase() === attached_host.toLowerCase()
	)

	function parse_dns_records(raw: unknown): DnsRecord[] {
		if (!raw) return []
		try {
			const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
			return Array.isArray(parsed) ? parsed : []
		} catch {
			return []
		}
	}

	function endpoint(site_id: string, path = '') {
		return `${self.instance?.baseURL}/api/primo/sites/${site_id}/domain${path}`
	}

	function auth_headers(json = false): Record<string, string> {
		const headers: Record<string, string> = {}
		if (self.instance?.authStore.token) headers['Authorization'] = `Bearer ${self.instance.authStore.token}`
		if (json) headers['Content-Type'] = 'application/json'
		return headers
	}

	async function handle_connect(event: SubmitEvent) {
		event.preventDefault()
		if (!site) return
		const host = new_site_host.trim().toLowerCase()
		error = ''

		if (!host) {
			error = 'Enter a domain (e.g. example.com)'
			return
		}

		// Already attached this host and waiting — a submit (e.g. Enter key) here
		// means "check status", not re-attach (which Railway rejects).
		if (awaiting) {
			refresh_status()
			return
		}

		connecting = true
		try {
			const response = await fetch(endpoint(site.id), {
				method: 'POST',
				headers: auth_headers(true),
				body: JSON.stringify({ host })
			})
			if (!response.ok) {
				const data = await response.json().catch(() => ({}))
				error = data.message || `Failed to connect domain (${response.status})`
				return
			}
			const result = await response.json()
			domain_status = result.status
			domain_records = result.records || []
			attached_host = host
			onconnected?.()
			// Live immediately (e.g. base-domain subdomain or manual) — close.
			if (domain_status === 'live') {
				open = false
			} else {
				start_poll(site.id)
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to connect domain'
		} finally {
			connecting = false
		}
	}

	// One-shot status check (the "Refresh status" button). The background poll
	// updates on its own timer; this lets the user check immediately.
	async function refresh_status() {
		if (!site) return
		error = ''
		connecting = true
		try {
			const response = await fetch(endpoint(site.id, '/status'), { headers: auth_headers() })
			if (response.ok) {
				const result = await response.json()
				domain_status = result.status
				domain_records = result.records || []
				onconnected?.()
				if (domain_status === 'live') {
					stop_poll()
				}
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to check status'
		} finally {
			connecting = false
		}
	}

	function start_poll(site_id: string) {
		stop_poll()
		const tick = async () => {
			try {
				const response = await fetch(endpoint(site_id, '/status'), { headers: auth_headers() })
				if (response.ok) {
					const result = await response.json()
					domain_status = result.status
					domain_records = result.records || []
					error = '' // a healthy status clears any stale attach error
					onconnected?.()
					if (domain_status === 'live') {
						stop_poll()
						return
					}
				}
			} catch {
				// transient — keep polling
			}
			poll_timer = setTimeout(tick, 30000)
		}
		poll_timer = setTimeout(tick, 30000)
	}

	function stop_poll() {
		if (poll_timer) clearTimeout(poll_timer)
		poll_timer = null
	}

	async function copy_dns(value: string) {
		try {
			await navigator.clipboard.writeText(value)
			copied_dns = value
			setTimeout(() => (copied_dns = null), 1500)
		} catch (err) {
			console.error('Failed to copy:', err)
		}
	}
</script>

<Dialog.Root
	bind:open
	onOpenChange={(is_open) => {
		if (!is_open) stop_poll()
	}}
>
	<Dialog.Content class="sm:max-w-[525px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Connect a domain</h2>
		<p class="text-muted-foreground text-sm">
			Enter the domain you want this site served at. We'll show you the DNS records to add at your registrar.
		</p>
		<form onsubmit={handle_connect}>
			<Input bind:value={new_site_host} placeholder="example.com" class="mt-4" autocomplete="off" spellcheck={false} />
			{#if error}
				<p class="text-red-500 text-sm mt-2">{error}</p>
			{/if}

			{#if domain_records.length > 0}
				<div class="mt-4 flex items-center gap-2 text-sm">
					{#if domain_status === 'live'}
						<span class="inline-flex items-center gap-1.5 text-green-500"><Check class="h-3.5 w-3.5" /> Live</span>
					{:else}
						<span class="inline-flex items-center gap-1.5 text-muted-foreground"><Loader class="h-3.5 w-3.5 animate-spin" /> Waiting for DNS &amp; certificate…</span>
					{/if}
				</div>
				<p class="text-muted-foreground text-xs mt-3 mb-2">Add these records at your DNS provider:</p>
				<div class="space-y-2">
					{#each domain_records as record}
						<div class="rounded-md bg-[#111] p-3 text-xs font-mono">
							<div class="flex items-center justify-between gap-2">
								<span class="text-muted-foreground uppercase">{record.type}</span>
								{#if record.status === 'valid'}
									<Check class="h-3.5 w-3.5 text-green-500" />
								{/if}
							</div>
							<div class="mt-1 truncate">{record.host}</div>
							<button
								type="button"
								onclick={() => copy_dns(record.value)}
								class="group mt-1 flex w-full items-center justify-between gap-2 text-left text-muted-foreground hover:text-foreground"
							>
								<span class="truncate">{record.value}</span>
								{#if copied_dns === record.value}
									<Check class="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
								{:else}
									<Copy class="h-3.5 w-3.5 flex-shrink-0 opacity-50 group-hover:opacity-100" />
								{/if}
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<Dialog.Footer class="mt-4">
				<Button type="button" variant="outline" onclick={() => (open = false)}>
					{domain_records.length > 0 ? 'Done' : 'Cancel'}
				</Button>
				{#if awaiting}
					<Button type="button" disabled={connecting} onclick={refresh_status}>
						{connecting ? 'Checking…' : 'Refresh status'}
					</Button>
				{:else}
					<Button type="submit" disabled={connecting}>{connecting ? 'Connecting…' : 'Connect'}</Button>
				{/if}
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
