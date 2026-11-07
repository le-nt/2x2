<script lang="ts">
    import { setTitle } from "@client/stores";
	import Button from "@components/legacy/Button.svelte";
	setTitle("Password Reset - ROBLOX");
</script>

<div class="text-center mt-6">
	<h1 class="text-2xl font-bold">Sorry!</h1>
	<p>We don't offer password resets at this time.</p>
	<p>Logistically, as we don't have a Discord server or email server, it is quite difficult to verify user identity reliably while keeping anonymity intact.</p>
	<Button class="mt-4" size="large" text="Back to ROBLOX" href="/" type="control" />
</div>