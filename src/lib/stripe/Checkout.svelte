<script>
	import axios from 'axios'
	import Icon from '@iconify/svelte'
	import { onMount, createEventDispatcher } from 'svelte'
	import { loadStripe } from '@stripe/stripe-js'
	import { PUBLIC_STRIPE_KEY } from '$env/static/public'
	import { EmbeddedCheckout } from 'svelte-stripe'
	import { page } from '$app/stores'

	let { price_id, metadata = {} } = $props();

	let clientSecret = $state()

	axios
		.post('/api/stripe/create-payment-intent', {
			price_id,
			user: $page.data.user,
			metadata,
			redirect_url: ``
		})
		.then(({ data }) => {
			clientSecret = data?.clientSecret
			console.log({ data, clientSecret })
		})

	let stripe = $state(null)

	onMount(async () => {
		stripe = await loadStripe(PUBLIC_STRIPE_KEY)
	})

	// TODO: redirect to the same page & open deploy modal
</script>

{#if clientSecret}
	<EmbeddedCheckout {stripe} {clientSecret} />
{:else}
	<div
		style="display: flex;justify-content: center;
  height: 100%;
  align-items: center;"
	>
		<Icon icon="eos-icons:three-dots-loading" width="50px" height="50px" />
	</div>
{/if}
