<script>
	import { invalidate } from '$app/navigation'
	import { page } from '$app/stores'
	import axios from 'axios'

	let n_collaborators = 0
	export async function get_n_collaborators() {
		const { data, error } = await $page.data.supabase.from('collaborators').select('*', { count: 'exact', head: true })
		if (error) {
			console.error(error)
		} else {
			n_collaborators = data || 0
		}
	}
	get_n_collaborators()

	// let image_hosting_usage = 0
	// $page.data.supabase
	// 	.from('bucket_sizes')
	// 	.select('size')
	// 	.eq('owner', $page.data.user.id)
	// 	.single()
	// 	.then(({ data }) => {
	// 		image_hosting_usage = data.size / 1000
	// 	})

	let is_pro = $derived($page.data.user.pro)
	let max_sites = $derived(3)
	let max_collaborators = $derived(3)
	let max_storage = $derived(is_pro ? 1000 : 10)

	$page.data.supabase
		.channel('schema-db-changes')
		.on(
			'postgres_changes',
			{
				event: 'UPDATE',
				schema: 'public',
				table: 'subscriptions',
				filter: `user=eq.${$page.data.user.id}`
			},
			() => {
				invalidate('app:data')
			}
		)
		.subscribe()

	async function cancel_subscription(site, subscription) {
		// TODO:
		// send cancellation email

		const res = window.confirm(`Are you sure you want to cancel your subscription?`)
		if (!res) return

		const { data } = await axios.post('/api/stripe/cancel-subscription', {
			subscription_id: subscription.subscription_id
		})
		if (data.success) {
			console.log('Subscription cancelled successfully')
			const { data } = await axios.post('/api/deploy/disconnect-domain-name', {
				site_id: site.id
			})
			console.log({ data })
		} else {
			alert('Failed to cancel subscription')
			console.error(data.error)
		}
	}
</script>

<div class="Invitation">
	<main>
		<h2>Billing</h2>

		<!-- <table>
			<thead>
				<tr>
					<th>Subscription</th>
					<th>Price</th>
				</tr>
			</thead>
			<tbody>
				{#each $page.data.subscriptions as subscription}
					<tr>
						<td>{subscription.name}</td>
						<td>${subscription.price}/month</td>
					</tr>
				{/each}
			</tbody>
		</table> -->

		{#each $page.data.sites.filter((s) => s.subscriptions.length > 0) as site}
			<div class="container">
				<h2
					style="display: flex;
				flex-direction: column; margin-bottom: 0.5rem;"
				>
					<span
						style="font-weight: 600;
					font-size: 1.25rem;"
					>
						{site.name}
					</span>
					<span style="color: #999">{site.custom_domain}</span>
				</h2>
				<table style="width: 100%">
					<thead>
						<tr style="text-align: left; border-bottom: 1px solid #222">
							<th>Subscription</th>
							<th>Price</th>
						</tr>
					</thead>
					<tbody>
						{#each site.subscriptions as subscription}
							{@const name = {
								CUSTOM_DOMAIN: 'Custom Domain',
								COLLABORATOR: 'Collaborator',
								FORMS: 'Forms'
							}[subscription.type]}
							{@const price = {
								CUSTOM_DOMAIN: '5',
								COLLABORATOR: '2',
								FORMS: '2'
							}[subscription.type]}
							<tr>
								<td>{name}</td>
								<td>${price}/month</td>
								<td>
									<button onclick={() => cancel_subscription(site, subscription)} style="text-decoration: underline">Cancel</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/each}
	</main>
</div>

<style lang="postcss">
	.Invitation {
		/* --Modal-max-width: 450px; */
		/* --Modal-padding: 1rem 1.5rem; */
		--Modal-align-items: center;
		padding: 1rem 1.5rem;
		color: var(--color-gray-1);
		min-width: 450px;
	}
	main {
		display: grid;
		gap: 1.5rem;
	}
	table {
		border: 1px solid #222;
		th,
		td {
			padding: 0.5rem;
		}
	}
</style>
