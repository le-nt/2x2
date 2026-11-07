<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
    import { page } from "$app/state";
    
	onMount(() => {
		if(page.error) {
			console.log(page.error);
		}
        goto(`/RobloxDefaultErrorPage.aspx?code=${page.status}`);
	});
</script>