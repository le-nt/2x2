<script>
    import { getRobloxObject } from "@client/qwebchannel";
    import Button from "@components/legacy/Button.svelte";
    import { onMount } from "svelte";

    let { data } = $props();
    let progress = $state(0);

    onMount(async () => {
        const roblox = await getRobloxObject();
        const success = roblox.SaveUrl(
            `/develop/upload?assetId=${data.asset.id}`
        );
        if (success) {
            progress = 100;
        } else {
            alert("Failed to upload place");
            window.close();
        }
    });
</script>

<div class="px-4 py-4">
    <h3 class="text-[15px] font-semibold mb-1">
        Uploading to "{data.asset.name}"
    </h3>

    <div class="flex">
        <div
            class="border border-[#a7a7a7] border-solid mr-2"
            style="width: 400px;height: 32px"
        >
            <div
                class="h-full bg-[url(/images/ide/bg-upload_progress.png)]"
                style="width: {progress}%;"
            ></div>
        </div>

        {#if progress == 100}
            <Button
                onclick={() => window.close()}
                type="neutral"
                text="OK"
                size="medium"
            />
        {:else}
            <Button
                href="/ide/publish"
                type="negative"
                text="Cancel"
                size="medium"
            />
        {/if}
    </div>

    <p class="text-[14px] mt-2 font-normal">
        {progress}% Completed
    </p>
</div>
