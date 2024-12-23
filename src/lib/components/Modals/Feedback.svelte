<script>
	import axios from 'axios'
	import UI from '$lib/builder/ui'
	import Button from '$lib/builder/ui/Button.svelte'
	import { page } from '$app/stores'

	let submitted = $state(false)

	let selected = 'bug'
	let placeholder = $derived(
		{
			bug: `Something isn't working right...`,
			feature: 'I would like to be able to...',
			question: 'How do I...',
			kudos: 'Something I love is...'
		}[selected]
	)
	let feedback = $state('')

	async function submit() {
		submitted = true

		await axios
			.post(
				'https://getform.io/f/3d7f29ee-54dc-4edf-8ccb-f786a21bcbc5',
				{
					type: selected,
					message: feedback,
					email: $page.data.user.email
				},
				{ headers: { Accept: 'application/json' } }
			)
			.then((response) => console.log(response))
			.catch((error) => console.log(error))
	}
</script>

<main>
	<h1>Feedback</h1>
	{#if !submitted}
		<form
			onsubmit={(e) => {
				e.preventDefault()
				submit()
			}}
		>
			<!-- TODO fix -->
			<UI.Select
				label="Type"
				options={[
					{
						value: 'bug',
						label: 'Bug Report'
					},
					{
						value: 'feature',
						label: 'Feature Request'
					},
					{
						value: 'question',
						label: 'Question'
					},
					{
						value: 'kudos',
						label: 'Kudos'
					}
				]}
			/>
			<textarea {placeholder} bind:value={feedback}></textarea>
			<Button type="submit" disabled={!feedback}>Submit</Button>
		</form>
	{:else}
		<p>Thanks for your feedback 🙂</p>
		{#if selected === 'question'}
			<p>We'll get back to you ASAP!</p>
		{:else if selected === 'bug'}
			<p>We'll let you know when that's fixed!</p>
		{/if}
	{/if}
</main>

<style type="postcss">
	main {
		background: var(--color-gray-9);
		padding: 1rem;

		h1 {
			font-weight: 500;
			margin-bottom: 1rem;
		}
		form {
			display: grid;
			gap: 0.5rem;

			textarea {
				background: #1f1f1f;
				padding: 0.5rem;
				border: 1px solid #404040;
				border-radius: var(--primo-border-radius);

				&::placeholder {
					color: #333;
				}
			}
		}
	}
</style>
