<script>
	import { onMount } from 'svelte'
	import { page } from '$app/state'
	import { self } from '$lib/pocketbase/instances'
	import { check_session } from '$lib/pocketbase/user'
	import { goto } from '$app/navigation'

	let forms = $state([])
	let submissions = $state([])
	let selected = $state('')
	let error = $state('')
	let ready = $state(false)
	let loading = $state(false)
	let emailConfigured = $state(false)
	let currentPage = $state(1)
	let hasMore = $state(false)
	const siteId = $derived(page.url.searchParams.get('site') || '')
	const base = $derived(`/api/primo/sites/${encodeURIComponent(siteId)}/forms`)

	async function loadSubmissions(number = 1) {
		if (!selected) return
		loading = true
		error = ''
		submissions = []
		try {
			const result = await self.send(`${base}/${encodeURIComponent(selected)}/submissions?page=${number}`, { method: 'GET' })
			submissions = result.items
			hasMore = result.hasMore
			currentPage = number
		} catch (cause) {
			error = cause.message
		} finally {
			loading = false
		}
	}

	onMount(async () => {
		if (!(await check_session())) {
			await goto('/admin/auth')
			return
		}
		try {
			if (!siteId) throw new Error('Open the inbox link supplied when installing your form.')
			const result = await self.send(base, { method: 'GET' })
			forms = result.items
			emailConfigured = result.emailConfigured
			selected = forms[0]?.slug || ''
			await loadSubmissions()
		} catch (cause) {
			error = cause.message
		} finally {
			ready = true
		}
	})
</script>

<svelte:head><title>Form submissions · Primo</title></svelte:head>
<main>
	<a href={siteId ? `/admin/sites/${encodeURIComponent(siteId)}` : '/admin/dashboard/sites'}>← Back to site</a>
	<h1>Form submissions</h1>
	{#if !ready}<p>Loading…</p>{/if}
	{#if error}<p role="alert">{error}</p>{/if}
	{#if ready && forms.length}
		<div class="controls">
			<label>
				Form <select bind:value={selected} onchange={() => loadSubmissions()} disabled={loading}>
					{#each forms as form}<option value={form.slug}>{form.definition.name}</option>{/each}
				</select>
			</label>
			<button onclick={() => loadSubmissions(currentPage)} disabled={loading}>Refresh</button>
		</div>
		{#if !emailConfigured}<p>Email delivery is not configured. Submissions are saved here; requested notifications remain pending until SMTP is enabled.</p>{/if}
		{#if loading}<p>Loading submissions…</p>
		{:else if !submissions.length && !error}<p>No submissions yet.</p>{/if}
		{#each submissions as submission}
			<article>
				<header>
					<time>{submission.created}</time>
					<span>Notification: {submission.notification}</span>
				</header>
				<dl>
					{#each Object.entries(submission.data) as [name, value]}<dt>{name}</dt>
						<dd>{value}</dd>{/each}
				</dl>
			</article>
		{/each}
		<nav aria-label="Submission pages">
			<button disabled={loading || currentPage === 1} onclick={() => loadSubmissions(currentPage - 1)}>Previous</button>
			<span>Page {currentPage}</span>
			<button disabled={loading || !hasMore} onclick={() => loadSubmissions(currentPage + 1)}>Next</button>
		</nav>
	{:else if ready && !error}<p>No forms installed on this site.</p>{/if}
</main>

<style>
	main {
		max-width: 56rem;
		margin: auto;
		padding: 3rem 1.5rem;
		color: #e8e8ec;
		font-family: system-ui, sans-serif;
	}
	h1 {
		font-size: 2rem;
		margin: 1.5rem 0;
	}
	a {
		color: #ff9870;
	}
	.controls,
	nav,
	header {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}
	button,
	select {
		font: inherit;
		padding: 0.5rem 0.8rem;
		background: #303038;
		border: 1px solid #666;
		border-radius: 0.4rem;
		color: inherit;
	}
	button:disabled {
		opacity: 0.5;
	}
	article {
		padding: 1.25rem;
		border: 1px solid #555;
		border-radius: 0.6rem;
		margin: 1rem 0;
	}
	header {
		justify-content: space-between;
		font-size: 0.85rem;
		color: #bbb;
	}
	dt {
		font-weight: 600;
		margin-top: 1rem;
	}
	dd {
		margin: 0.25rem 0 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	p {
		margin: 1rem 0;
	}
</style>
