<script>
	import { pageTitle } from "@client/stores";
	import { beforeNavigate } from "$app/navigation";
	import "virtual:uno.css";
    import "@components/css/main.css";
	let { children } = $props();
	beforeNavigate(({ to, from }) => {
		if (to && from?.url.pathname !== to.url.pathname) {
			pageTitle.set("");
		}
	});
</script>

<svelte:head>
	<title>{$pageTitle !== "" ? $pageTitle : "ROBLOX.com"}</title>
</svelte:head>

{@render children?.()}