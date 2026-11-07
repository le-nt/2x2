<script>
	import "virtual:uno.css";
</script>

<slot />

<style>
	:global(html) {
		box-sizing: border-box;
	}
	:global(*, *:before, *:after) {
		box-sizing: inherit;
	}
	:global(body) {
		background: #eee;
		min-height: 100vh;
		margin: 0;
		font-family: Verdana, Arial, sans-serif;
	}
</style>
