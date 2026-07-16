<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog'
	import * as Sidebar from '$lib/components/ui/sidebar'
	import * as AlertDialog from '$lib/components/ui/alert-dialog'
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
	import * as RadioGroup from '$lib/components/ui/radio-group'
	import { Label } from '$lib/components/ui/label'
	import SitePreview from '$lib/components/SitePreview.svelte'
	import { Input } from '$lib/components/ui/input'
	import EmptyState from '$lib/components/EmptyState.svelte'
	import { Separator } from '$lib/components/ui/separator'
	import { Button } from '$lib/components/ui/button'
	import { Globe, Loader, ChevronDown, SquarePen, Trash2, EllipsisVertical, ArrowLeftRight, Download, CirclePlus, Copy, Check } from 'lucide-svelte'
	import { useSidebar } from '$lib/components/ui/sidebar'
	import { page } from '$app/state'
	import type { Site } from '$lib/common/models/Site'
	import { Sites, SiteGroups, Pages } from '$lib/pocketbase/collections'
	import { self as pb, self } from '$lib/pocketbase/managers'
	import { goto } from '$app/navigation'
	import { ClientResponseError } from 'pocketbase'
	import { useSiteSnapshot } from '$lib/Snapshot.svelte'
	import { Snapshot } from '$lib/common/models/Snapshot'
	import { instance } from '$lib/instance'
	import { is_host_assigned, site_editor_url } from '$lib/site_host'
	import CreateSite from '$lib/components/CreateSite.svelte'

	const sidebar = useSidebar()

	const site_group_id = $derived(page.url.searchParams.get('group'))
	$effect(() => {
		if (!site_group_id && site_groups.length > 0) {
			const url = new URL(page.url)
			url.searchParams.set('group', site_groups[0].id)
			goto(url, { replaceState: true })
		}
	})

	const site_groups = $derived(SiteGroups.list() ?? [])
	const active_site_group = $derived(site_group_id ? SiteGroups.one(site_group_id) : undefined)
	const all_sites = $derived(Sites.list() ?? [])
	const sites = $derived(site_group_id ? all_sites.filter((site) => site.group === site_group_id) : [])

	// Plan site cap: 0/undefined means unlimited. Enforced server-side in
	// internal/limits.go; this just disables the affordance + shows usage.
	const at_site_cap = $derived(!!instance.site_cap && all_sites.length >= instance.site_cap)

	let is_rename_group_open = $state(false)
	let new_group_name = $state('')
	$effect(() => {
		if (active_site_group) {
			new_group_name = active_site_group.name
		}
	})
	async function handle_group_rename(e) {
		e.preventDefault()
		if (!active_site_group) return
		SiteGroups.update(active_site_group.id, { name: new_group_name })
		await self.commit()
		is_rename_group_open = false
	}

	let is_delete_group_open = $state(false)
	let deleting_group = $state(false)
	async function handle_group_delete() {
		deleting_group = true
		if (!active_site_group) return
		SiteGroups.delete(active_site_group.id)
		await self.commit()
		deleting_group = false
		is_delete_group_open = false
	}

	let download_site_id: string | null = $state(null)
	let download_site_name: string | null = $state(null)
	let downloading = $state(false)
	const snapshot_worker = $derived(download_site_id ? useSiteSnapshot({ source_site_id: download_site_id }) : null)

	$effect(() => {
		if (download_site_id && snapshot_worker && snapshot_worker.status === 'standby' && !downloading) {
			downloading = true
			snapshot_worker.run().then((snapshot) => {
				const file = Snapshot.encode(snapshot)
				const url = URL.createObjectURL(file)
				const a = document.createElement('a')
				a.href = url
				a.download = `${download_site_name?.replace(/[^a-zA-Z0-9]/g, '_') ?? 'site'}.primo`
				document.body.appendChild(a)
				a.click()
				document.body.removeChild(a)
				URL.revokeObjectURL(url)
				download_site_id = null
				download_site_name = null
				downloading = false
			}).catch((error) => {
				console.error('Failed to download site:', error)
				download_site_id = null
				download_site_name = null
				downloading = false
			})
		}
	})

	function download_site_file(site: Site) {
		download_site_id = site.id
		download_site_name = site.name
	}

	let is_rename_site_open = $state(false)
	let new_site_name = $state('')
	let current_site: Site | null = $state(null)

	$effect(() => {
		if (current_site) {
			new_site_name = current_site.name || ''
		}
	})

	async function handle_rename() {
		if (!current_site) return
		Sites.update(current_site.id, { name: new_site_name })
		await self.commit()
		is_rename_site_open = false
	}

	// Assigning a domain flips a site from unassigned (host === id) to a real
	// host, which is what makes it publicly served. The server-side domain
	// provider (Railway in hosted mode, manual otherwise) attaches the host and
	// returns the DNS records the user must create; we then poll until the cert
	// is live. Uniqueness + validation are enforced server-side.
	type DnsRecord = { type: string; host: string; value: string; status: string; purpose: string }
	let is_assign_domain_open = $state(false)
	let new_site_host = $state('')
	let assign_domain_error = $state('')
	let assigning_domain = $state(false)
	let domain_status = $state('')
	let domain_records: DnsRecord[] = $state([])
	let copied_dns: string | null = $state(null)
	let poll_timer: ReturnType<typeof setTimeout> | null = null

	$effect(() => {
		if (current_site) {
			new_site_host = is_host_assigned(current_site) ? current_site.host : ''
			domain_status = current_site.domain_status || ''
			domain_records = parse_dns_records(current_site.domain_dns_records)
		}
	})

	function parse_dns_records(raw: unknown): DnsRecord[] {
		if (!raw) return []
		try {
			const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
			return Array.isArray(parsed) ? parsed : []
		} catch {
			return []
		}
	}

	function domain_endpoint(site_id: string, path = '') {
		return `${self.instance?.baseURL}/api/primo/sites/${site_id}/domain${path}`
	}

	function auth_headers(json = false): Record<string, string> {
		const headers: Record<string, string> = {}
		if (self.instance?.authStore.token) headers['Authorization'] = `Bearer ${self.instance.authStore.token}`
		if (json) headers['Content-Type'] = 'application/json'
		return headers
	}

	async function handle_assign_domain(event: SubmitEvent) {
		event.preventDefault()
		if (!current_site) return
		const host = new_site_host.trim().toLowerCase()
		assign_domain_error = ''

		if (!host) {
			assign_domain_error = 'Enter a domain (e.g. example.com)'
			return
		}

		assigning_domain = true
		try {
			const response = await fetch(domain_endpoint(current_site.id), {
				method: 'POST',
				headers: auth_headers(true),
				body: JSON.stringify({ host })
			})
			if (!response.ok) {
				const data = await response.json().catch(() => ({}))
				assign_domain_error = data.message || `Failed to assign domain (${response.status})`
				return
			}
			const result = await response.json()
			domain_status = result.status
			domain_records = result.records || []
			// Live immediately (e.g. base-domain subdomain or manual) — close.
			if (domain_status === 'live') {
				is_assign_domain_open = false
			} else {
				start_domain_poll(current_site.id)
			}
		} catch (error) {
			assign_domain_error = error instanceof Error ? error.message : 'Failed to assign domain'
		} finally {
			assigning_domain = false
		}
	}

	function start_domain_poll(site_id: string) {
		stop_domain_poll()
		const tick = async () => {
			try {
				const response = await fetch(domain_endpoint(site_id, '/status'), { headers: auth_headers() })
				if (response.ok) {
					const result = await response.json()
					domain_status = result.status
					domain_records = result.records || []
					if (domain_status === 'live') {
						stop_domain_poll()
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

	function stop_domain_poll() {
		if (poll_timer) clearTimeout(poll_timer)
		poll_timer = null
	}

	async function copy_dns(value: string) {
		try {
			await navigator.clipboard.writeText(value)
			copied_dns = value
			setTimeout(() => (copied_dns = null), 1500)
		} catch (error) {
			console.error('Failed to copy:', error)
		}
	}

	let is_delete_site_open = $state(false)
	let deleting_site = $state(false)
	async function delete_site() {
		if (!current_site) return
		deleting_site = true

		try {
			const siteId = current_site.id

			try {
				// Delete home page first to avoid cascade deletion conflicts
				const home = await pb.instance?.collection('pages').getFirstListItem(`site = "${siteId}" && parent = ""`)
				if (home) {
					Pages.delete(home.id)
				}
			} catch (error) {
				if (error instanceof ClientResponseError && error.status === 404) {
					// Ignore "not found" error
				} else {
					throw error
				}
			}

			// Delete the site - PocketBase will cascade delete remaining records
			Sites.delete(siteId)
			await self.commit()

			is_delete_site_open = false
		} catch (error) {
			if (error instanceof ClientResponseError && error.status === 404) {
				// Site already deleted - treat as success
				is_delete_site_open = false
			} else {
				console.error('Error deleting site:', error)
			}
		} finally {
			deleting_site = false
		}
	}

	let is_move_site_open = $state(false)
	let selected_group_id = $state(site_groups[0]?.id ?? '')
	async function move_site() {
		if (!current_site) return
		Sites.update(current_site.id, { group: selected_group_id })
		await self.commit()
		is_move_site_open = false
	}

	let is_creating_site = $state(false)
</script>

<header class="flex h-14 shrink-0 items-center gap-2">
	<div class="flex flex-1 items-center gap-2 px-3">
		<Sidebar.Trigger />
		<Separator orientation="vertical" class="mr-2 h-4" />
		<div class="text-sm">{active_site_group?.name}</div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<button {...props}>
						<ChevronDown class="h-4" />
						<span class="sr-only">More</span>
					</button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content class="w-56 rounded-lg" side="bottom" align={sidebar.isMobile ? 'end' : 'start'}>
				<DropdownMenu.Item onclick={() => (is_rename_group_open = true)}>
					<SquarePen class="text-muted-foreground" />
					<span>Rename</span>
				</DropdownMenu.Item>
				{#if site_groups?.length}
					<DropdownMenu.Item onclick={() => (is_delete_group_open = true)}>
						<Trash2 class="text-muted-foreground" />
						<span>Delete</span>
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
	<div class="ml-auto mr-4 flex items-center gap-3">
		{#if instance.site_cap}
			<span class="text-xs text-muted-foreground">{all_sites.length} of {instance.site_cap} sites</span>
		{/if}
		<Button
			size="sm"
			variant="outline"
			disabled={at_site_cap}
			title={at_site_cap ? 'Site limit reached for your plan. Upgrade to add more sites.' : undefined}
			onclick={() => (is_creating_site = true)}
		>
			<CirclePlus class="h-4 w-4" />
			Create Site
		</Button>
	</div>
</header>
<div class="flex flex-1 flex-col gap-4 px-4 pb-4">
	{#if sites?.length}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each sites as site}
				{@render SiteButton(site)}
			{/each}
		</div>
	{:else}
		<EmptyState class="h-[50vh]" icon={Globe} title="No Sites to display" description="It looks like you haven't created any websites yet." />
	{/if}
</div>

{#snippet SiteButton(site: Site)}
	<div class="space-y-3 relative w-full bg-[#111]">
		<div class="rounded-tl rounded-tr overflow-hidden">
			<a href={site_editor_url(site)}>
				<SitePreview {site} />
			</a>
		</div>
		<div class="absolute -bottom-2 rounded-bl rounded-br w-full p-3 z-20 bg-[#111] truncate flex items-center justify-between">
			<div class="flex flex-col gap-1" style="max-width: calc(100% - 2rem)">
				<a href={site_editor_url(site)} class="text-sm font-medium leading-none truncate">{site.name}</a>
				<p class="text-xs text-muted-foreground leading-tight truncate">{is_host_assigned(site) ? site.host : 'Unassigned'}</p>
			</div>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger class="p-2 hover:bg-[#222] rounded-md">
					<EllipsisVertical size={14} />
				</DropdownMenu.Trigger>
				<DropdownMenu.Content>
					<DropdownMenu.Item
						onclick={() => {
							current_site = site
							is_rename_site_open = true
						}}
					>
						<SquarePen class="h-4 w-4" />
						<span>Rename</span>
					</DropdownMenu.Item>
					<DropdownMenu.Item
						onclick={() => {
							current_site = site
							is_assign_domain_open = true
						}}
					>
						<Globe class="h-4 w-4" />
						<span>{is_host_assigned(site) ? 'Change domain' : 'Assign domain'}</span>
					</DropdownMenu.Item>
					{#if site_groups.length > 1}
						<DropdownMenu.Item
							onclick={() => {
								current_site = site
								is_move_site_open = true
							}}
						>
							<ArrowLeftRight class="h-4 w-4" />
							<span>Move</span>
						</DropdownMenu.Item>
					{/if}
					<DropdownMenu.Item onclick={() => download_site_file(site)} disabled={downloading && download_site_id === site.id}>
						{#if downloading && download_site_id === site.id}
							<Loader class="h-4 w-4 animate-spin" />
							<span>Downloading...</span>
						{:else}
							<Download class="h-4 w-4" />
							<span>Download</span>
						{/if}
					</DropdownMenu.Item>
					<DropdownMenu.Item
						onclick={() => {
							current_site = site
							is_delete_site_open = true
						}}
						class="text-red-500 hover:text-red-600 focus:text-red-600"
					>
						<Trash2 class="h-4 w-4" />
						<span>Delete</span>
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>
{/snippet}

<Dialog.Root bind:open={is_rename_group_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Rename group</h2>
		<p class="text-muted-foreground text-sm">Enter a new name for your group</p>
		<form onsubmit={handle_group_rename}>
			<Input bind:value={new_group_name} placeholder="Enter new group name" class="my-4" />
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (is_rename_group_open = false)}>Cancel</Button>
				<Button type="submit">Rename</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={is_delete_group_open}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you sure?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will permanently delete <strong>{active_site_group?.name}</strong>
				and
				<strong>all</strong>
				its sites.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={handle_group_delete} class="bg-red-600 hover:bg-red-700">
				{#if deleting_group}
					<div class="animate-spin absolute">
						<Loader />
					</div>
				{:else}
					Delete {active_site_group?.name}
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

<Dialog.Root bind:open={is_move_site_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<div class="grid gap-4">
			<div class="space-y-2">
				<h4 class="font-medium leading-none">Move to group</h4>
				<p class="text-muted-foreground text-sm">Select a group for this site</p>
			</div>
			<RadioGroup.Root bind:value={selected_group_id}>
				{#each site_groups as group}
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value={group.id} id={group.id} />
						<Label for={group.id}>{group.name}</Label>
					</div>
				{/each}
			</RadioGroup.Root>
			<div class="flex justify-end">
				<Button onclick={move_site}>Move</Button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={is_rename_site_open}>
	<Dialog.Content class="sm:max-w-[425px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Rename Site</h2>
		<p class="text-muted-foreground text-sm">Enter a new name for your site</p>
		<form onsubmit={handle_rename}>
			<Input bind:value={new_site_name} placeholder="Enter new site name" class="my-4" />
			<Dialog.Footer>
				<Button type="button" variant="outline" onclick={() => (is_rename_site_open = false)}>Cancel</Button>
				<Button type="submit">Rename</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	bind:open={is_assign_domain_open}
	onOpenChange={(open) => {
		if (!open) stop_domain_poll()
	}}
>
	<Dialog.Content class="sm:max-w-[525px] pt-12 gap-0">
		<h2 class="text-lg font-semibold leading-none tracking-tight">Connect a domain</h2>
		<p class="text-muted-foreground text-sm">
			Enter the domain you want this site served at. We'll show you the DNS records to add at your registrar.
		</p>
		<form onsubmit={handle_assign_domain}>
			<Input bind:value={new_site_host} placeholder="example.com" class="mt-4" autocomplete="off" spellcheck={false} />
			{#if assign_domain_error}
				<p class="text-red-500 text-sm mt-2">{assign_domain_error}</p>
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
				<Button type="button" variant="outline" onclick={() => (is_assign_domain_open = false)}>
					{domain_records.length > 0 ? 'Done' : 'Cancel'}
				</Button>
				<Button type="submit" disabled={assigning_domain}>{assigning_domain ? 'Connecting…' : 'Connect'}</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={is_delete_site_open}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you sure?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will permanently delete <strong>{current_site?.name}</strong>
				and remove all associated data.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={delete_site} class="bg-red-600 hover:bg-red-700">
				{#if deleting_site}
					<div class="animate-spin absolute">
						<Loader />
					</div>
				{:else}
					Delete {current_site?.name}
				{/if}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>

{#if is_creating_site}
	<!-- CreateSite is a full-screen wizard; render it as an overlay above the
	dashboard. New sites are created unassigned (no host); on success we close
	the wizard and stay on the dashboard, where the new card appears. -->
	<div class="fixed inset-0 z-50 bg-background overflow-auto">
		<CreateSite
			oncreated={() => {
				// The site was created server-side via the clone-site endpoint —
				// an out-of-band write the Sites cache doesn't know about — so
				// invalidate the cached lists to re-fetch and show the new card
				// without a full reload.
				self.invalidate_lists({ collection_name: 'sites' })
				is_creating_site = false
			}}
			oncancel={() => {
				is_creating_site = false
			}}
		/>
	</div>
{/if}
