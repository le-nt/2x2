<script lang="ts">
	import { page } from "$app/state";
	import Emscripten from "@components/Emscripten.svelte";
	import { redirect } from "@sveltejs/kit";
    import Button from "@components/legacy/Button.svelte";
	const data = page.data;
	let features = data.features;
	let gamesEnabled = features.find(
		(f: any) => f.key === "gamesEnabled"
	)?.enabled;
</script>

{#if gamesEnabled}
	<Emscripten placeId={page.data.placeId} />
{:else}
    <!-- unocss -->
    <div class="text-center mt-50">
        <img src="/images/ohnoes.png" alt="Maintenance" class="mb-4" />
        <h2 class="text-2xl font-bold">Gameservers are currently disabled</h2>
        <p class="text-gray-600">Please try again later.</p>
        <Button type="negative" size="medium" text="Go Back" onclick={() => history.back()} class="mt-4" />
    </div>
{/if}
