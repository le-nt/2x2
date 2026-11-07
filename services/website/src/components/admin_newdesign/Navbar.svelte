<script lang="ts">
	import {
		Icon,
		colorMode,
		useColorMode,
	} from "@sveltestrap/sveltestrap";
	import { Menu } from "lucide-svelte";

	let { toggleSidebar } = $props();
</script>

<div
	class="d-flex align-items-center justify-content-between px-3 h-100 bg-gradient bg-primary text-white"
>
	<div class="d-flex align-items-center">
		<button class="btn btn-dark btn-sm me-2 d-md-none" onclick={toggleSidebar}>
			<Menu class="" />
		</button>
		<span class="small fw-semibold">Customer Service & Moderation</span>
	</div>

	<span class="d-flex align-items-center gap-2">
		<button
			class="btn btn-link p-0 text-decoration-none small {$colorMode === 'light' ? 'fw-bold' : ''}"
			onclick={() => useColorMode('light')}
			style="color: inherit;"
		>
			<Icon name="sun-fill" /> light
		</button>
		•
		<button
			class="btn btn-link p-0 text-decoration-none small {$colorMode === 'dark' ? 'fw-bold' : ''}"
			onclick={() => useColorMode('dark')}
			style="color: inherit;"
		>
			<Icon name="moon-stars-fill" /> dark
		</button>
		•
		<form method="POST" action="/cs/logout" style="display: inline">
			<button type="submit" class="btn btn-link p-0 underline small" style="color: inherit;">
				logout
			</button>
		</form>
	</span>
</div>
