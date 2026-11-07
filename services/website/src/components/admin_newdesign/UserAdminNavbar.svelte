<script lang="ts">
	let { userId } = $props();
	let activeTab = $state("Account Summary");
</script>

<div
	class="d-flex px-2 overflow-auto no-scrollbar bg-body-tertiary border-bottom shadow-sm position-sticky"
	style="top: var(--admin-nav-height, 54px); z-index: 1000;"
	data-sveltekit-preload-code="eager"
	data-sveltekit-preload-data="eager"
>
	{#each ["Account Summary", "Moderate", "Transactions", "Grant Membership", "Grant Assets", "IP", "PII ID"] as tab}
		<a
			href="#"
			class="nav-tab-btn {activeTab === tab ? 'active' : ''}"
			onclick={(e) => {
				e.preventDefault();
				activeTab = tab;
			}}
		>
			{tab}
		</a>
	{/each}
</div>

<style>
	.nav-tab-btn {
		background: none;
		border: none;
		padding: 10px 18px;
		font-size: 14px;
		color: var(--bs-secondary-color);
		border-bottom: 3px solid transparent;
		white-space: nowrap;
		text-decoration: none;
	}

	.nav-tab-btn:hover {
		color: var(--bs-body-color);
	}

	.nav-tab-btn.active {
		color: var(--bs-primary);
		border-bottom-color: var(--bs-primary);
		font-weight: 600;
	}

	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
</style>
