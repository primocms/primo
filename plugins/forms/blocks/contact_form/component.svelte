<script>
	let status = $state('idle')
	let error = $state('')
	let requestId = ''
	let previousData = ''

	async function submit(event) {
		event.preventDefault()
		if (status === 'sending') return
		const element = event.currentTarget
		const fields = new FormData(element)
		const data = { name: fields.get('name'), email: fields.get('email'), message: fields.get('message') }
		const serialized = JSON.stringify(data)
		if (!requestId || serialized !== previousData) requestId = crypto.randomUUID()
		previousData = serialized
		status = 'sending'
		error = ''
		try {
			// Use same origin on hosted sites. The configured origin also supports editor previews.
			const origin = server_url || window.location.origin
			const runtimeURL = new URL('/api/primo/runtime/forms.js', origin).href
			const { createPrimo } = await import(/* @vite-ignore */ runtimeURL)
			const primo = createPrimo({ siteId: site_id, baseURL: origin })
			await primo.forms.submit('contact', data, { requestId, website: fields.get('website') })
			status = 'success'
			requestId = ''
			element.reset()
		} catch (cause) {
			status = 'error'
			error = cause.message || 'Your message could not be submitted. Please try again.'
		}
	}
</script>

<section>
	<h2>{title}</h2>
	<form onsubmit={submit}>
		<label>
			Your name <input name="name" autocomplete="name" required maxlength="200" />
		</label>
		<label>
			Email <input name="email" type="email" autocomplete="email" required maxlength="254" />
		</label>
		<label>
			Message <textarea name="message" rows="6" required maxlength="5000"></textarea>
		</label>
		<div class="trap" aria-hidden="true">
			<label>
				Leave blank <input name="website" tabindex="-1" autocomplete="off" />
			</label>
		</div>
		<button disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : 'Send message'}</button>
		<div aria-live="polite">
			{#if status === 'success'}<p>Thanks—your message has been received.</p>{/if}
			{#if status === 'error'}<p role="alert">{error}</p>{/if}
		</div>
	</form>
</section>

<style>
	section {
		max-width: 38rem;
		margin: auto;
		padding: 3rem 1.5rem;
	}
	h2 {
		font-size: 2rem;
		margin-bottom: 1.5rem;
	}
	form,
	label {
		display: grid;
		gap: 0.5rem;
	}
	form {
		gap: 1.25rem;
	}
	input,
	textarea,
	button {
		font: inherit;
		border-radius: 0.5rem;
		padding: 0.8rem 1rem;
	}
	input,
	textarea {
		border: 1px solid #aaa;
		width: 100%;
		box-sizing: border-box;
	}
	button {
		background: #222;
		color: white;
		border: 0;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.trap {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
</style>
