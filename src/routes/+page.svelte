<script>
	import { goto } from '$app/navigation'
	import { check_session } from '$lib/pocketbase/user'
	import { onMount } from 'svelte'
	import { self } from '$lib/pocketbase/managers'

	onMount(async () => {
		if (await check_session()) {
			await goto(self.instance?.authStore.record?.serverRole ? '/admin/site' : '/admin/dashboard/sites', { replaceState: true })
		} else {
			await goto('/admin/auth', { replaceState: true })
		}
	})
</script>
