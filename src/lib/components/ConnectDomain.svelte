<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import { Input } from '$lib/components/ui/input'
	import { Button } from '$lib/components/ui/button'
	import { Copy, Check, Loader, ChevronRight, ExternalLink, TriangleAlert } from 'lucide-svelte'
	import { onDestroy } from 'svelte'
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
		site: Pick<Site, 'id' | 'host' | 'domain_status' | 'domain_dns_records' | 'domain_error'> | null | undefined
		open?: boolean
		onconnected?: () => void
	} = $props()

	let new_site_host = $state('')
	let error = $state('')
	let connecting = $state(false)
	let domain_status = $state('')
	let domain_error = $state('')
	let domain_records: DnsRecord[] = $state([])
	let copied_dns: string | null = $state(null)
	let poll_timer: ReturnType<typeof setTimeout> | null = null
	// The host the shown records/status belong to. Lets us tell "still checking
	// the attached domain" (→ Refresh) from "typed a new domain" (→ Connect).
	let attached_host = $state('')
	// The user has typed into the input (or is mid-change). Guards the seeding
	// effect below so a reactive `site` update (realtime subscription echo,
	// list invalidation) can't clobber an in-progress entry.
	let dirty = $state(false)

	// Seed local state from the site record. Reads the reactive `site` prop, so
	// it re-runs whenever that record changes — hence the `dirty` guard on the
	// input-bound field, and the auto-poll for a domain that's already pending
	// (e.g. reopening the dialog on a site attached in a prior session).
	$effect(() => {
		if (!site) return
		const assigned = is_host_assigned(site) ? site.host : ''
		if (!dirty) {
			new_site_host = assigned
		}
		attached_host = assigned
		domain_status = site.domain_status || ''
		domain_error = site.domain_error || ''
		domain_records = parse_dns_records(site.domain_dns_records)
		// A domain that's attached but not yet live needs the poll running to
		// advance to live on its own — otherwise reopening shows a spinner that
		// never resolves without a manual refresh.
		if (assigned && domain_status && domain_status !== 'live' && domain_status !== 'error') {
			start_poll(site.id)
		}
	})

	// The entered host matches the attached one (vs. the user typing a new
	// domain to switch to).
	const on_attached_host = $derived(new_site_host.trim().toLowerCase() === attached_host.toLowerCase())
	// Live: attached host is serving. Records collapse behind a toggle.
	const live = $derived(domain_status === 'live' && on_attached_host && !!attached_host)
	// Errored: the platform failed to issue the cert. A terminal state — the
	// user must fix DNS and re-attach, so surface it instead of spinning.
	const errored = $derived(domain_status === 'error' && on_attached_host && !!attached_host)
	// Awaiting: attached but not yet live/errored — primary action is re-check,
	// not re-attach (which errors on an already-attached domain). Doesn't require
	// visible records: the platform can report pending/verifying with none yet.
	const awaiting = $derived(!!attached_host && domain_status !== '' && domain_status !== 'live' && domain_status !== 'error' && on_attached_host)

	// Show the attached domain's records only while the input still matches it.
	// Once the user edits the input to switch domains, the old records are stale.
	const show_records = $derived(domain_records.length > 0 && on_attached_host)

	// In the live state the domain shows as read-only text; the editable input is
	// revealed only when the user opts to change it.
	let changing = $state(false)
	// Show the editable input unless we're settled on a live domain and the user
	// hasn't asked to change it.
	const show_input = $derived(!live || changing)

	// DNS records are shown by default while pending, collapsed once live.
	let records_open = $state(false)

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
			attached_host = host
			changing = false
			// The entry is now committed to the server; let the seeding effect
			// track the record again.
			dirty = false
			apply_status(result)
			// Live immediately (e.g. base-domain subdomain or manual) — close.
			if (domain_status === 'live') {
				open = false
			} else if (domain_status !== 'error') {
				start_poll(site.id)
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to connect domain'
		} finally {
			connecting = false
		}
	}

	// Apply a /status response to local state and stop polling once the domain
	// has reached a terminal state (live or error). Shared by the manual refresh
	// and the background poll so they can't drift.
	function apply_status(result: { status: string; records?: DnsRecord[]; error?: string }) {
		domain_status = result.status
		domain_records = result.records || []
		domain_error = result.error || ''
		onconnected?.()
		if (domain_status === 'live' || domain_status === 'error') stop_poll()
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
				apply_status(await response.json())
			} else {
				const data = await response.json().catch(() => ({}))
				error = data.message || `Failed to check status (${response.status})`
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to check status'
		} finally {
			connecting = false
		}
	}

	function start_poll(site_id: string) {
		// Idempotent: the seeding effect may re-run on reactive site changes, and
		// we don't want to stack timers or reset the countdown each time.
		if (poll_timer) return
		const tick = async () => {
			poll_timer = null
			try {
				const response = await fetch(endpoint(site_id, '/status'), { headers: auth_headers() })
				if (response.ok) {
					error = '' // a healthy status clears any stale attach error
					apply_status(await response.json())
					if (domain_status === 'live' || domain_status === 'error') return
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

	// The dialog's onOpenChange only fires on interactive close, not on unmount
	// (the editor tears down this subtree on session expiry / site change). Stop
	// the self-rescheduling poll on destroy so it can't leak forever.
	onDestroy(stop_poll)

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

{#snippet copy_row(label: string, value: string)}
	<div class="flex items-center gap-2">
		<span class="text-muted-foreground shrink-0 w-10">{label}</span>
		<span class="min-w-0 flex-1 truncate" title={value}>{value}</span>
		<button type="button" onclick={() => copy_dns(value)} class="shrink-0 text-muted-foreground hover:text-foreground" aria-label="Copy {label}">
			{#if copied_dns === value}
				<Check class="h-3.5 w-3.5 text-green-500" />
			{:else}
				<Copy class="h-3.5 w-3.5 opacity-50 hover:opacity-100" />
			{/if}
		</button>
	</div>
{/snippet}

<Dialog.Root
	bind:open
	onOpenChange={(is_open) => {
		if (!is_open) {
			stop_poll()
			changing = false
		}
	}}
>
	<Dialog.Content class="!w-[min(525px,calc(100vw-1rem))] max-w-none pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">
			{live && !changing ? 'Domain' : 'Connect a domain'}
		</h2>
		<p class="text-muted-foreground text-sm">
			{#if live && !changing}
				This site is live at your domain.
			{:else}
				Enter the domain you want this site served at. We'll show you the DNS records to add at your registrar.
			{/if}
		</p>
		<form onsubmit={handle_connect} class="min-w-0">
			{#if show_input}
				<Input bind:value={new_site_host} oninput={() => (dirty = true)} placeholder="example.com" class="mt-4" autocomplete="off" spellcheck={false} />
			{:else}
				<!-- Live + not changing: read-only domain display -->
				<div class="mt-4 flex items-center justify-between gap-2 rounded-md border border-input px-3 py-2 min-w-0">
					<span class="truncate font-medium">{attached_host}</span>
					<a href="https://{attached_host}" target="_blank" rel="noopener" class="shrink-0 inline-flex items-center gap-1 text-muted-foreground hover:text-foreground text-sm">
						Visit <ExternalLink class="h-3.5 w-3.5" />
					</a>
				</div>
			{/if}
			{#if error}
				<p class="text-red-500 text-sm mt-2">{error}</p>
			{/if}

			{#if live}
				<div class="mt-3 flex items-center justify-between gap-2 text-sm">
					<span class="inline-flex items-center gap-1.5 text-green-500"><Check class="h-3.5 w-3.5" /> Live</span>
					{#if !changing}
						<button
							type="button"
							onclick={() => {
								changing = true
								dirty = true
							}}
							class="text-muted-foreground hover:text-foreground"
						>
							Change domain
						</button>
					{/if}
				</div>
			{:else if errored}
				<div class="mt-4 flex items-start gap-2 text-sm">
					<span class="inline-flex items-center gap-1.5 text-red-500"><TriangleAlert class="h-3.5 w-3.5" /> Couldn't issue a certificate for this domain.</span>
				</div>
				{#if domain_error}
					<p class="text-muted-foreground text-xs mt-1">{domain_error}</p>
				{/if}
				<p class="text-muted-foreground text-xs mt-1">Check the DNS records below, then connect again.</p>
			{:else if awaiting || show_records}
				<div class="mt-4 flex items-center gap-2 text-sm">
					<span class="inline-flex items-center gap-1.5 text-muted-foreground"><Loader class="h-3.5 w-3.5 animate-spin" /> Waiting for DNS &amp; certificate…</span>
				</div>
			{/if}

			{#if show_records}
				{#if live}
					<button type="button" onclick={() => (records_open = !records_open)} class="mt-3 flex items-center gap-1 text-muted-foreground hover:text-foreground text-xs">
						<ChevronRight class="h-3.5 w-3.5 transition-transform {records_open ? 'rotate-90' : ''}" /> DNS records
					</button>
				{:else}
					<p class="text-muted-foreground text-xs mt-3 mb-2">Add these records at your DNS provider:</p>
				{/if}

				{#if !live || records_open}
					<div class="space-y-2 min-w-0 {live ? 'mt-2' : ''}">
						{#each domain_records as record}
							<div class="rounded-md bg-[#111] p-3 text-xs font-mono space-y-1.5 min-w-0 overflow-hidden">
								<div class="flex items-center justify-between gap-2">
									<span class="text-muted-foreground uppercase">{record.type}</span>
									{#if record.status === 'valid'}
										<Check class="h-3.5 w-3.5 text-green-500" />
									{/if}
								</div>
								{@render copy_row('Name', record.host)}
								{@render copy_row('Value', record.value)}
							</div>
						{/each}
					</div>
				{/if}
			{/if}

			<Dialog.Footer class="mt-4">
				{#if changing && on_attached_host}
					<!-- Revealed the input to change the domain but haven't typed a
					new one yet: let the user back out to the live view. -->
					<Button
						type="button"
						variant="outline"
						onclick={() => {
							changing = false
							dirty = false
							new_site_host = attached_host
						}}
					>
						Cancel
					</Button>
				{:else}
					<Button type="button" variant={live ? 'default' : 'outline'} onclick={() => (open = false)}>
						{show_records || live ? 'Done' : 'Cancel'}
					</Button>
				{/if}
				{#if awaiting}
					<Button type="button" disabled={connecting} onclick={refresh_status}>
						{connecting ? 'Checking…' : 'Refresh status'}
					</Button>
				{:else if !live}
					<Button type="submit" disabled={connecting}>{connecting ? 'Connecting…' : 'Connect'}</Button>
				{/if}
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
