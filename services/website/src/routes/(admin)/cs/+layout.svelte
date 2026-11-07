<script lang="ts">
	let { data, children } = $props();
	import { page } from "$app/stores";
	import { Styles, colorMode, useColorMode, Container } from "@sveltestrap/sveltestrap";
	import "@components/css/admin/main.css";
	import { onMount } from "svelte";
	import { pageTitle } from "@client/stores";
	import Sidebar from "@components/admin_newdesign/Sidebar.svelte";
	import Navbar from "@components/admin_newdesign/Navbar.svelte";
	import { api } from "@client/api";

	const normalLayoutUnused = [
		"/cs/logout",
		"/cs/totp/challenge",
		"/cs/totp/enroll",
	]

	const path = $page.url.pathname;

	let isSidebarOpen = $state(false);
	let dashData = $state<any>(null);

	function toggleSidebar() {
		isSidebarOpen = !isSidebarOpen;
	}

	onMount(async () => {
		const saved = localStorage.getItem("cs-theme");
		if (saved) {
			useColorMode(saved);
			if (saved === "light" || saved === "dark") {
				document.documentElement.setAttribute("data-bs-theme", saved);
			}
		}

		const req = await api.admin.dashBoardData.get(fetch);
		if (!req.error) {
			dashData = req.data.data;
		}
	});

	$effect(() => {
		if (typeof window !== "undefined" && $colorMode) {
			localStorage.setItem("cs-theme", $colorMode);
		}
	});
</script>

<Styles theme={$colorMode} />
<svelte:head>
	<link rel="icon" href="/dole.ico" />
	<script>
		// * this sucks ass but it stops it from flashing white
		(function () {
			try {
				var saved = localStorage.getItem("cs-theme");
				if (saved === "dark" || saved === "light") {
					document.documentElement.setAttribute("data-bs-theme", saved);
				}
			} catch (e) {}
		})();
	</script>

	<title>{$pageTitle !== "" ? `${$pageTitle} | Roblox CS` : "Roblox CS"}</title>
</svelte:head>

<div
	data-sveltekit-preload-data="off"
	data-sveltekit-preload-code="off"
	class="cswebsite"
>
	{#if !normalLayoutUnused.includes(path)}
		<Sidebar isOpen={isSidebarOpen} {toggleSidebar} user={data.user} {dashData} />

	<div class="top-bar fixed-top bg-body border-bottom shadow-sm">
		<Container fluid class="px-0 h-100">
			<Navbar {toggleSidebar} />
		</Container>
	</div>

	<main class="cslayout">
		{@render children?.()}
	</main>
	{:else}
		{@render children?.()}
	{/if}
</div>

<style>
	:global(:root) {
		--admin-nav-height: 40px;
	}

	.top-bar {
		left: 260px;
		width: calc(100% - 260px);
		height: var(--admin-nav-height);
		transition:
			left 0.3s ease,
			width 0.3s ease;
	}

	.cslayout {
		margin-left: 260px;
		padding-top: var(--admin-nav-height);
		padding-bottom: 2rem;
		transition: margin-left 0.3s ease;
	}

	@media (max-width: 768px) {
		.top-bar {
			left: 0;
			width: 100%;
		}

		.cslayout {
			margin-left: 0;
			padding-top: var(--admin-nav-height);
		}
	}
</style>