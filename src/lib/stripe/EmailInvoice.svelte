<script>
	import axios from 'axios'
	import Icon from '@iconify/svelte'
	import { page } from '$app/stores'

	let { metadata = {}, price_id } = $props();

	const site = $page.data.site

	let loading = $state(false)
	let email = $state('')

	async function email_invoice() {
		loading = true
		const { data: success } = await axios.post('/api/stripe/email-invoice', {
			email,
			price_id,
			site,
			metadata
		})
		if (success) {
			alert(`The invoice has been sent. When it's paid, the feature will become available.`)
		} else {
			alert('Could not send invoice. Please try again.')
		}
		email = ''
		loading = false
	}
</script>

<div class="EmailInvoice">
	<main>
		<form onsubmit={(e) => {
			e.preventDefault()
			email_invoice()
		}}>
			<label class="subheading" for="email">Email invoice</label>
			<div>
				<div class="input-group">
					<input bind:value={email} type="email" placeholder="Email address" name="email" />
				</div>
				<button type="submit">
					{#if loading}
						<Icon icon="eos-icons:three-dots-loading" />
					{:else}
						Send invoice
					{/if}
				</button>
			</div>
		</form>
	</main>
</div>

<style lang="postcss">
	.EmailInvoice {
		/* padding: 1rem 1.5rem; */
		color: var(--color-gray-1);
		background: #111;
		overflow: auto;
	}
	main {
		display: grid;
		gap: 1.5rem;
	}
	.subheading {
		font-weight: 700;
		font-size: 0.75rem;
		margin-bottom: 0.5rem;
	}
	form {
		display: grid;
		gap: 0.25rem;

		div {
			display: flex;
			gap: 0.5rem;
			font-size: 0.75rem;

			.input-group {
				flex: 1;
				border-radius: 4px;
				border: 1px solid var(--color-gray-7);
				color: var(--color-gray-2);
			}

			input {
				flex: 1;
				padding: 0.25rem 0.5rem;
				background: transparent;
			}

			button {
				padding: 10px 12px;
				background: var(--color-gray-7);
				border-radius: 4px;
			}
		}
	}
</style>
