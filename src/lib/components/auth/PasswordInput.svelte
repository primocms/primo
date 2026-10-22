<script lang="ts">
	import { Eye, EyeOff } from 'lucide-svelte'
	import { Input } from '$lib/components/ui/input'
	import { Button } from '$lib/components/ui/button'
	let {
		value = $bindable(''),
		id,
		name,
		label = 'Password',
		autocomplete = 'new-password',
		disabled = false,
		minlength,
		describedby,
		testId
	}: {
		value?: string
		id: string
		name: string
		label?: string
		autocomplete?: 'new-password' | 'current-password'
		disabled?: boolean
		minlength?: number
		describedby?: string
		testId?: string
	} = $props()
	let visible = $state(false)
</script>

<div class="auth-label">
	<label for={id}>{label}</label>
	<div class="relative">
		<Input {id} {name} bind:value type={visible ? 'text' : 'password'} {autocomplete} {disabled} {minlength} required aria-describedby={describedby} data-test-id={testId} class="h-10 pr-10" />
		<Button
			type="button"
			variant="ghost"
			size="icon"
			class="absolute right-1 top-1 h-8 w-8"
			{disabled}
			aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
			aria-pressed={visible}
			onclick={() => (visible = !visible)}
		>
			{#if visible}<EyeOff aria-hidden="true" />{:else}<Eye aria-hidden="true" />{/if}
		</Button>
	</div>
</div>
