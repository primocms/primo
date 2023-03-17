<script>
	export let letter = 'b';
</script>

<span class="letter">
	<span class="inner-letter">{letter}</span>
</span>

<style>
	.letter {
		height: 30px;
		width: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #81a6fd;
		color: white;
		font-weight: 500;
		font-size: 14px;
		line-height: 0;
		border-radius: 50%;
	}
	.inner-letter {
		position: relative;
		top: -2px;
	}
</style>
