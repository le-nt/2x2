<script lang="ts">
    // * I HATE ROBLOX
	import Search from "./Search.svelte";
	let { sidebarOpen = $bindable(false), user, legacyPage } = $props();

	function headerMarginClass() {
		if (!user) {
			return legacyPage ? "ml-[27px] xl:ml-[12px]" : "ml-[27px] 2xl:ml-[12px]";
		}
		return "ml-[12px]";
	}

	function menuHideClass() {
		return legacyPage ? "xl:hidden" : "2xl:hidden";
	}

	function format(val: number | bigint | string): string {
        if (typeof val === "string") return val;
		const numVal = typeof val === "bigint" ? Number(val) : val;
		const units = [
			{ value: 1e24, suffix: "Qi" },
			{ value: 1e21, suffix: "Qa" }, // ? Can bigints even store this much lmao
			{ value: 1e18, suffix: "Q" },
			{ value: 1e15, suffix: "T" },
			{ value: 1e12, suffix: "B" },
			{ value: 1e9, suffix: "M" },
			{ value: 1e6, suffix: "M" },
			{ value: 1e3, suffix: "K" }
		];

		for (const unit of units) {
			if (numVal >= unit.value) {
				return (numVal / unit.value).toFixed(1).replace(/\.0$/, "") + unit.suffix + "+";
			}
		}
		return numVal.toString();
	}

	let robux = $derived(user ? format(user.robux) : "0");
	let tix = $derived(user ? format(user.tickets) : "0");
</script>

<header class="w-full bg-[#0074BD] pb-[3px] top-0 fixed" style="z-index: 999999">
	<div class="flex flex-row">
		<div class="{headerMarginClass()} mr-[12px] h-full flex">
			{#if user}
				<button
					class="mr-[12px] pt-[5px] pr-[5px] block {menuHideClass()}"
					onclick={() => (sidebarOpen = !sidebarOpen)}
					aria-label="Open Sidebar"
				>
					<span class="icon-nav-menu"></span>
				</button>
			{/if}
			<a class="pt-[5px]" href="/" aria-label="Home">
				<span class="header-logo" class:legacy={legacyPage} class:new={!legacyPage}></span>
			</a>
		</div>

		<ul class="hidden md:flex text-center list-none p-0 m-0 flex-grow nav-buttons col-md-4 col-lg-1 text-[16px]">
            <li class="mt-[4.5px] flex flex-grow justify-center">
                <a href="/games" class="!text-white block py-[6px] px-[8px]">Games</a>
            </li>
            <li class="mt-[4.5px] flex flex-grow justify-center">
                <a href="/catalog" class="!text-white block py-[6px] px-[8px]">Catalog</a>
            </li>
            <li class="mt-[4.5px] flex flex-grow justify-center">
                <a href="/develop" class="!text-white block py-[6px] px-[8px]">Develop</a>
            </li>
            <li class="mt-[4.5px] flex flex-grow justify-center">
                <a href="/upgrades/robux" class="!text-white block py-[6px] px-[8px]">ROBUX</a>
            </li>
		</ul>

		<Search />

		<div class="mr-[12px] ml-auto col-xs-4 col-sm-3 col-md-5 text-[16px]">
			{#if !user}
				<ul class="flex ml-auto w-[80%] md:w-[42%] xl:w-[40%] text-center list-none p-0 m-0 flex-grow nav-buttons">
					<li class="mt-[4.5px] flex flex-grow justify-center">
						<a href="/" class="!text-white block py-[6px] px-[4px]">Sign Up</a>
					</li>
					<li class="mt-[4.5px] flex flex-grow justify-center">
						<a href="/newlogin" class="!text-white block py-[6px] px-[4px]">Log In</a>
					</li>
				</ul>
			{:else}
				<ul class="flex flex-row-reverse ml-auto text-center list-none p-0 m-0 flex-grow">
					<li>
						<button class="!text-white block pt-[6px] pl-[9px] pr-2 flex font-normal" aria-label="Settings">
							<span class="icon-nav-settings"></span>
						</button>
					</li>
					<li>
						<button class="!text-white block pt-[6px] px-[9px] flex font-normal" aria-label="Tickets">
							<span class="icon-nav-tix"></span>
							<span class="mt-1 ml-1">{tix}</span>
						</button>
					</li>
					<li>
						<button class="!text-white block pt-[6px] px-[9px] flex font-normal" aria-label="Robux">
							<span class="icon-nav-robux"></span>
							<span class="mt-1 ml-1">{robux}</span>
						</button>
					</li>
				</ul>
			{/if}
		</div>
	</div>

	<ul class="flex md:hidden mb-[-2px] text-center list-none p-0 m-0 flex-grow nav-buttons text-[16px]">
        <li class="mt-[10px] flex flex-grow justify-center">
            <a href="/games" class="!text-white block py-[6px] px-[8px]">Games</a>
        </li>
        <li class="mt-[10px] flex flex-grow justify-center">
            <a href="/catalog" class="!text-white block py-[6px] px-[8px]">Catalog</a>
        </li>
        <li class="mt-[10px] flex flex-grow justify-center">
            <a href="/develop" class="!text-white block py-[6px] px-[8px]">Develop</a>
        </li>
        <li class="mt-[10px] flex flex-grow justify-center">
            <a href="/upgrades/robux" class="!text-white block py-[6px] px-[8px]">ROBUX</a>
        </li>
	</ul>
</header>

<style>
	div {
		font-size: 16px;
		font-weight: 300;
		line-height: 1.3em;
	}

	.header-logo {
		background-image: url("/images/Logo/logo_R.svg");
		background-repeat: no-repeat;
		background-size: auto auto;
		width: 30px;
		height: 30px;
		display: block;
		background-size: 30px;
	}

	.nav-buttons li a:focus,
	.nav-buttons li a:hover {
		background-color: rgba(25, 25, 25, 0.1);
		border-radius: 5px;
	}

	@media (min-width: 1360px) {
		.header-logo.legacy {
			background-image: url("/images/Logo/roblox_logo.svg");
			width: 118px;
			height: 30px;
			background-size: 118px 30px;
		}
	}

	@media (min-width: 1688px) {
		.header-logo.new {
			background-image: url("/images/Logo/roblox_logo.svg");
			width: 118px;
			height: 30px;
			background-size: 118px 30px;
		}
	}
</style>
