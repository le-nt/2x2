<script lang="ts">
	import { hasHigherTrait } from "@client/traits";
	import Button from "@components/Button.svelte";
	import { UserAdminTraitSafe } from "@shared/prisma-browser";
	let { open = $bindable(false), user, legacyPage } = $props();
	import { onMount } from "svelte";
	import init, { salam_aleykum } from "@sherlock/sherlock_core";
	import { GavelIcon, MessageCircleWarning, Package, } from 'lucide-svelte';

	onMount(async () => {
		try {
			await init();
			salam_aleykum();
		} catch (e) {}
	});
</script>

<div
	class="left-sidebar"
	class:open
	class:legacy={legacyPage}
	class:new={!legacyPage}
>
	<a
		class="!text-[#191919] pt-[10px] px-[10px] block"
		href="/users/{user.id}/profile">{user.username}</a
	>
	<div class="sidebar-divider mt-[5px] mx-2.5"></div>

	<div class="sidebar-scrollbar">
		<ul class="pl-[10px] pr-[10px] sidenav">
			<li class="mb-[9px]">
				<a id="nav-home" href="/home" class="flex flex-row">
					<span class="icon-nav-home"></span>
					<span class="mx-[3px] my-[4px] text-[16px]">Home</span>
				</a>
			</li>
			<li class="mb-[9px]">
				<a
					id="nav-profile"
					href="/users/{user.id}/profile"
					class="flex flex-row"
				>
					<span class="icon-nav-profile"></span>
					<span class="mx-[3px] my-[4px] text-[16px]">Profile</span>
				</a>
			</li>
			<li class="mb-[9px]">
				<a id="nav-message" href="/my/messages" class="flex flex-row">
					<span class="icon-nav-message"></span>
					<span class="mx-[3px] my-[4px] text-[16px]">Messages</span>
				</a>
			</li>
			<li class="mb-[9px]">
				<a
					id="nav-friends"
					href="/users/{user.id}/friends"
					class="flex flex-row"
				>
					<span class="icon-nav-friends"></span>
					<span class="mx-[3px] my-[4px] text-[16px]">Friends</span>
				</a>
			</li>
			<li class="mb-[9px]">
				<a id="nav-character" href="/my/character.aspx" class="flex flex-row">
					<span class="icon-nav-charactercustomizer"></span>
					<span class="mx-[3px] my-[4px] text-[16px]">Character</span>
				</a>
			</li>
			<li class="mb-[9px]">
				<a
					id="nav-inventory"
					href="/users/{user.id}/inventory"
					class="flex flex-row"
				>
					<span class="icon-nav-inventory"></span>
					<span class="mx-[3px] my-[4px] text-[16px]">Inventory</span>
				</a>
			</li>
			<li class="mb-[9px]">
				<a id="nav-trade" href="/my/money.aspx" class="flex flex-row">
					<span class="icon-nav-trade"></span>
					<span class="mx-[3px] my-[4px] text-[16px]">Trade</span>
				</a>
			</li>
			<li class="mb-[9px]">
				<a id="nav-group" href="/my/groups.aspx" class="flex flex-row">
					<span class="icon-nav-group"></span>
					<span class="mx-[3px] my-[4px] text-[16px]">Groups</span>
				</a>
			</li>
			<li class="mb-[9px]">
				<a id="nav-forum" href="/Forum/Default.aspx" class="flex flex-row">
					<span class="icon-nav-forum"></span>
					<span class="mx-[3px] my-[4px] text-[16px]">Forum</span>
				</a>
			</li>
			<li class="mb-[9px]">
				<a id="nav-blog" href="/blog" class="flex flex-row">
					<span class="icon-nav-blog"></span>
					<span class="mx-[3px] my-[4px] text-[16px]">Blog</span>
				</a>
			</li>
			{#if hasHigherTrait(user.roleSet, UserAdminTraitSafe.AssetManager)}
				<li class="mb-[9px]" data-sveltekit-preload-code="off" data-sveltekit-preload-data="off">
					<a
						id="nav-cs"
						href="/cs"
						class="flex flex-row"
						rel="external"
					>
						<GavelIcon class="w-[28px] h-[28px]" />
						<span class="mx-[3px] my-[4px] text-[16px]">CS</span>
					</a>	
				</li>
			{/if}
			<!-- this is jank so we have to log stuff -->
			<!-- {console.log("admi: "+user.adminStatus)} -->
			<li class="my-[12px]">
				<Button
					class="w-full !py-[7px] px-4 !text-[16px]"
					size="xs"
					type="secondary"
					text="Upgrade Now"
				/>
			</li>
		</ul>
	</div>
</div>

<style>
	div {
		font-size: 16px;
		font-weight: 300;
		line-height: 1.3em;
	}

	.left-sidebar {
		width: 0;
		background-color: #f2f2f2;
		box-shadow: 0 0 60px rgba(25, 25, 25, 0.5);
		font-size: 16px;
		left: 0;
		overflow: hidden;
		height: 100%;
		position: fixed;
		top: 79px;
		z-index: 999;
	}

	.left-sidebar.open {
		width: 175px;
	}

	@media (min-width: 1360px) {
		.left-sidebar.legacy {
			box-shadow: 0 0 3px rgba(25, 25, 25, 0.3);
			width: 175px;
		}
	}

	@media (min-width: 1688px) {
		.left-sidebar.new {
			box-shadow: 0 0 3px rgba(25, 25, 25, 0.3);
			width: 175px;
		}
	}

	@media (min-width: 992px) {
		.left-sidebar {
			top: 40px;
		}
	}

	.left-sidebar a {
		line-height: 1.25;
		font-size: 18px;
	}

	.sidebar-divider {
		height: 1px;
		background-color: #b8b8b8;
		overflow: hidden;
	}

	@media (min-width: 1688px) {
		.sidebar-scrollbar {
			width: 175px;
		}
	}

	.sidebar-scrollbar {
		overflow: auto;
		height: 100%;
	}

	.sidebar-scrollbar {
		height: 100%;
		height: calc(100% - 90px);
	}

	.sidebar-scrollbar {
		overflow: auto;
		height: 100%;
	}

	.sidenav > li > a {
		color: #191919;
	}

	#nav-home:hover,
	#nav-inventory:hover {
		color: #02b757;
	}

	#nav-profile:hover,
	#nav-character:hover {
		color: #f68802;
	}

	#nav-message:hover,
	#nav-friends:hover,
	#nav-trade:hover,
	#nav-group:hover,
	#nav-forum:hover,
	#nav-blog:hover {
		color: #00a2ff;
	}

	#nav-cs:hover {
		color: red;
	}
</style>
