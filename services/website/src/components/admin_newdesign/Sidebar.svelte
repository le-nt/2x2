<script lang="ts">
	import {
		Card,
		CardHeader,
		ListGroup,
		ListGroupItem,
	} from "@sveltestrap/sveltestrap";
	import { X } from "lucide-svelte";
	import { page } from "$app/stores";
	import { nav, type NavItem } from "@shared/admin_nav";
	import {ExternalLink} from "lucide-svelte";
	import { hasHigherTrait } from "@client/traits";
	import { UserAdminTraitSafe } from "@shared/prisma-browser";
	import { api } from "@client/api";
	import { onMount } from "svelte";

	let { isOpen, toggleSidebar, user, dashData = null } = $props();

	const visibleNavItems = $derived(
		nav.filter(
			(item: NavItem) =>
				!item.hidden &&
				hasHigherTrait(user?.roleSet || UserAdminTraitSafe.Unprivileged, item.minimumRole)
		)
	);

	const categories = $derived(
		["Customer Service", "Web", "Infrastructure",].filter(
			(category) => visibleNavItems.some((item) => item.category === category)
		)
	);

	function isActive(href: string) {
		const path = $page.url.pathname;
		if (href === "/cs") return path === href;
		return path === href || path.startsWith(href + "/");
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="sidebar-overlay" onclick={toggleSidebar}></div>
{/if}

<aside class="sidebar bg-dark-subtle shadow-sm {isOpen ? 'open' : ''}">
	<div
		class="sidebar-brand d-flex align-items-center justify-content-between px-3 py-4"
	>
		<div>
			<span class="header-logo new" aria-label="ROBLOX"></span>
			<br />
			<small>Hi <span class="fw-bold">{user.username}</span></small> <br />
			<small class="text-muted"
				><b>{dashData?.userCount ?? "?"}</b> total users | <b>{dashData?.signUpsToday ?? 0}</b> sign ups today</small
			>
			<hr style="margin-top: 10px; margin-bottom: 10px;" />
			<small class="text-muted"
				><b>{dashData?.pendingReports ?? "?"}</b>
				<a
					href="/cs/backlog/abuse"
					data-sveltekit-preload-data="off"
					data-sveltekit-preload-code="off">abuse reports</a
				>,
				<b>{dashData?.pendingAssetQueue ?? "?"}</b>
				<a
					href="/cs/backlog/assets"
					data-sveltekit-preload-data="off"
					data-sveltekit-preload-code="off">pending assets</a
				></small
			>
			<a
				class="text-muted d-block small mt-1"
				href="/home"
				rel="external"
				data-sveltekit-preload-data="off"
				data-sveltekit-preload-code="off">Back to ROBLOX</a
			>
		</div>
		<button class="btn d-md-none border-0" onclick={toggleSidebar}>
			<X />
		</button>
	</div>

	<div class="px-2">
		{#each categories as category}
			<Card class="mb-3">
				<CardHeader class="{category === 'Infrastructure' ? 'bg-danger' : category === 'Web' ? 'bg-info' : 'bg-primary'} text-white">
					<span class="small fw-semibold">{category}</span>
				</CardHeader>
				<ListGroup flush>
					{#each visibleNavItems.filter((item) => item.category === category) as item}
						<ListGroupItem
							tag="a"
							href={item.href}
							action
							class="border-0 small py-2 px-3"
							data-sveltekit-preload-data={item.externalLink ? "off" : undefined}
							data-sveltekit-preload-code={item.externalLink ? "off" : undefined}
							color={isActive(item.href) ? "secondary" : undefined}
						>
							<span class="d-flex align-items-center gap-2">{item.label}
								{#if item.externalLink}
									<ExternalLink size="15" />
								{/if}
							</span>
						</ListGroupItem>
					{/each}
				</ListGroup>
			</Card>
		{/each}
	</div>
</aside>

<style>
	.sidebar {
		width: 260px;
		height: 100vh;
		position: fixed;
		top: 0;
		left: 0;
		z-index: 1100;
		overflow-y: auto;
		transition: transform 0.3s ease;
	}

	@media (max-width: 768px) {
		.sidebar {
			transform: translateX(-100%);
		}

		.sidebar.open {
			transform: translateX(0);
		}

		.sidebar-overlay {
			position: fixed;
			top: 0;
			left: 0;
			width: 100vw;
			height: 100vh;
			background: rgba(0, 0, 0, 0.5);
			z-index: 1090;
		}
	}
</style>
