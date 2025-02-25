<script>
	import Icon from '@iconify/svelte'
	import _ from 'lodash-es'
	import UI from '$lib/builder/ui'
	import ModalHeader from '$lib/components/ModalHeader.svelte'
	import { page } from '$app/stores'
	import axios from 'axios'
	import { PUBLIC_BASE_DOMAIN_NAME } from '$env/static/public'

	let { stage = $bindable() } = $props()

	async function publish_site() {
		// const res = await site_actions.deploy($page.data.site.id, $page.data.site.custom_domain)
		// console.log({ res })
		loading = true
		const { data } = await axios.post('/api/deploy/publish-changes', {
			site_id: $page.data.site.id
		})
		console.log({ data })
		loading = false
		stage = 'PUBLISHED'
	}

	if ($page.data.site.custom_domain_connected) {
		stage = 'DOMAIN_CONNECTED'
	} else if ($page.data.site.custom_domain && !$page.data.site.custom_domain_connected) {
		stage = 'CONNECTING_DOMAIN'
	} else if (!stage) {
		stage = 'INITIAL'
	}

	let domain_name = $state($page.data.site.custom_domain)

	let dns_record_completions = $state(
		$page.data.site.dns_records || {
			cname: false,
			ssl: false,
			verification: false
		}
	)

	let ownership_verification = $state($page.data.site.ownership_verification)
	async function setup_domain_name() {
		loading = true
		const { data } = await axios.post('/api/deploy/setup-domain-name', {
			domain_name,
			site_id: $page.data.site.id
		})
		if (data.success) {
			stage = 'CONNECTING_DOMAIN'
			ownership_verification = data.ownership_verification
		}
		loading = false
	}

	let ssl_validation = $state($page.data.site.ssl_validation)
	async function connect_domain_name() {
		loading = true
		const { data } = await axios.post('/api/deploy/connect-domain-name', {
			domain_name,
			site_id: $page.data.site.id
		})

		if (data.ssl_validation_record) {
			ssl_validation = data.ssl_validation_record
		}
		dns_record_completions = data.dns_record_completions

		if (data.success) {
			stage = 'DOMAIN_CONNECTED'
		}
		loading = false
	}

	let loading = $state(false)
</script>

<ModalHeader title="Publish" icon="entypo:publish" />
<div class="Deploy primo-reset">
	{#if stage === 'INITIAL'}
		<div class="container">
			<p class="description">
				Your website is live at <a href="https://{$page.data.site.id}.{PUBLIC_BASE_DOMAIN_NAME}" target="blank">
					{$page.data.site.id}.{PUBLIC_BASE_DOMAIN_NAME}
				</a>
			</p>
			<div class="buttons">
				<button class="primo-button secondary" onclick={() => (stage = 'INPUTTING_DOMAIN')}>
					<Icon icon="ph:link-bold" />
					<span>Connect Custom Domain</span>
				</button>
				<button class="primo-button primary" onclick={publish_site}>
					<Icon icon={loading ? 'line-md:loading-twotone-loop' : 'entypo:publish'} />
					<span>Publish Changes</span>
				</button>
			</div>
		</div>
	{:else if stage === 'INPUTTING_DOMAIN'}
		<p class="description">
			Connect your website to a domain name. Note that you will need to connect it to a subdomain, so if connecting to the root you'll need to use www.yourdomain.com and forward the root to the 'www'
			subdomain.
		</p>
		<div class="buttons">
			<UI.TextInput
				label="Domain name"
				placeholder="www.somewhere.com"
				bind:value={domain_name}
				button={{
					label: 'Connect Custom Domain',
					onclick: setup_domain_name
				}}
			/>
		</div>
	{:else if stage === 'CONNECTING_DOMAIN'}
		<div class="container">
			<p class="description">
				Your website is live at
				<a href="https://{$page.data.site.id}.{PUBLIC_BASE_DOMAIN_NAME}" target="blank">
					{$page.data.site.id}.{PUBLIC_BASE_DOMAIN_NAME}
				</a>
			</p>
			<div class="buttons">
				<button class="primo-button primary" onclick={publish_site}>
					<Icon icon="entypo:publish" />
					<span>Publish Changes</span>
				</button>
			</div>
		</div>
		<hr />
		<p class="description">Your domain name will be connected as soon as the DNS records listed below are in place.</p>
		<div>
			<div class="dns-record">
				{#if dns_record_completions.cname}
					<div class="label">
						<span>Link domain name to site</span>
						<Icon icon="lets-icons:check-fill" />
					</div>
				{:else}
					<div class="label">Link domain name to site</div>
					<div class="contents">
						<UI.TextInput label="Type" value="CNAME" disabled />
						<UI.TextInput label="Name" value={domain_name} disabled />
						<UI.TextInput label="Value" value="proxy.{PUBLIC_BASE_DOMAIN_NAME}" disabled />
					</div>
				{/if}
			</div>
			<div class="dns-record">
				{#if dns_record_completions.verification}
					<div class="label">
						<span>Verify ownership</span>
						<Icon icon="lets-icons:check-fill" />
					</div>
				{:else}
					<div class="label">Verify ownership</div>
					<div class="contents">
						<UI.TextInput label="Type" value="TXT" disabled />
						<UI.TextInput label="Name" value={ownership_verification.name} disabled />
						<UI.TextInput label="Value" value={ownership_verification.value} disabled />
					</div>
				{/if}
			</div>
			{#if ssl_validation}
				<div class="dns-record">
					{#if dns_record_completions.ssl}
						<div class="label">
							<span>Verify ownership</span>
							<Icon icon="lets-icons:check-fill" />
						</div>
					{:else}
						<div class="label">Validate SSL certificate</div>
						<div class="contents">
							<UI.TextInput label="Type" value="TXT" disabled />
							<UI.TextInput label="Name" value={ssl_validation.txt_name} disabled />
							<UI.TextInput label="Value" value={ssl_validation.txt_value} disabled />
						</div>
					{/if}
				</div>
			{/if}
			{#if domain_name.includes('www')}
				<div class="dns-record">
					<div class="label">
						<Icon icon="jam:alert" />
						<span>Set up a permanent (301) redirect from your root domain to the 'www' subdomain</span>
					</div>
				</div>
			{/if}

			<div class="buttons">
				<button disabled={loading} class="primo-button secondary" onclick={connect_domain_name}>
					{#if loading}
						<Icon icon="line-md:loading-twotone-loop" />
						<span>Checking DNS Records</span>
					{:else}
						<Icon icon="ic:outline-refresh" />
						<span>Refresh</span>
					{/if}
				</button>
			</div>
		</div>
	{:else if stage === 'DOMAIN_CONNECTED'}
		<p class="description">
			Your website is live at <a href="https://{domain_name}" target="blank">
				{domain_name}
			</a>
		</p>
		<div class="buttons">
			<button
				class="primo-button primary"
				disabled={loading}
				onclick={async () => {
					loading = true
					await publish_site()
					loading = true
				}}
			>
				<Icon icon={loading ? 'line-md:loading-twotone-loop' : 'entypo:publish'} />
				<span>Publish Changes</span>
			</button>
		</div>
	{:else if stage === 'PUBLISHED'}
		{@const url = $page.data.site.custom_domain || `${$page.data.site.id}.${PUBLIC_BASE_DOMAIN_NAME}`}
		<p class="description">
			Your website changes have been published to <a href="https://{url}" target="blank">
				{url}
			</a>
		</p>
	{/if}
</div>

<style lang="postcss">
	hr {
		border-color: var(--color-gray-9);
		margin: 1rem 0;
	}
	.Deploy.primo-reset {
		color: white;
		background: var(--primo-color-black);
		padding: 1.125rem 1.25rem;
		display: grid;
		gap: 1rem;
		width: 100%;
	}
	.container {
		display: grid;
		gap: 1rem;
	}

	.dns-record {
		background: var(--color-gray-9);
		border-radius: var(--primo-border-radius);
		margin-bottom: 1rem;

		.label {
			padding-left: 1rem;
			padding-top: 0.75rem;
			font-size: 0.875rem;
			border-bottom: 1px solid #121212;
			padding-bottom: 0.5rem;
			display: flex;
			align-items: center;
			gap: 0.5rem;
		}

		.contents {
			display: grid;
			grid-template-columns: 1fr 3fr 3fr;
			gap: 0.5rem;
			padding: 1rem;
		}
	}

	.description {
		a {
			text-decoration: underline;
		}
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 1rem;
	}
	.primo-button {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 7px 16px;
		background: #1f1f1f;
		border-radius: 0.25rem;
		justify-self: start;
		/* height: 100%; */
	}
	.primo-button.primary {
		border: 1px solid #70809e;
		background: transparent;
	}
	:global(form > label) {
		flex: 1;
	}
</style>
