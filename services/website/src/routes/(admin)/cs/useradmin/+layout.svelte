<script lang="ts">
	import { page } from '$app/stores';

	let userId = $derived($page.url.searchParams.get('id'));
	let path = $derived($page.url.pathname);

	const tabs = [
		{ name: 'Account', href: '/cs/useradmin/summary', match: '/summary' },
		{ name: 'Moderate', href: '/cs/useradmin/moderate', match: '/moderate' },
		{ name: 'IP', href: '/cs/useradmin/ips', match: '/ips' },
		{ name: "PII ID", href: '/cs/useradmin/fingerprints', match: '/fingerprints' }
	];
</script>

<div class="border-bottom bg-body mb-4">
	<div class="d-flex px-3 gap-4">
		{#each tabs as tab}
			<a
				href="{tab.href}?id={userId}"
				rel="external"
				class="text-decoration-none py-2 {path.includes(tab.match)
					? 'text-primary border-bottom border-primary border-2 fw-semibold'
					: 'text-muted'}"
				style="margin-bottom: -1px;"
			>
				{tab.name}
			</a>
		{/each}
	</div>
</div>

<slot />