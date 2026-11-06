<script lang="ts">
	import { page } from '$app/state'
</script>

<div class="placeholder" role="alert">{page.error?.message || 'Something went wrong. Reload and try again.'}</div>

<style>
	.placeholder {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
		color: white;
	}
</style>
