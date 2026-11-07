<script>
    import { goto } from "$app/navigation";
    import Button from "@components/legacy/Button.svelte";
    import Asset from "../Asset.svelte";

    let { data } = $props();
</script>

<div class="h-full relative">
    <div class="p-[20px] pb-[60px]">
        <h3 class="!p-0 text-[15px] font-semibold !text-[#343434]">Choose an existing place to overwrite, or create a new place.</h3>

        <div class="border border-[#ccc] border-solid mb-5 mt-1 p-[20px]" style="min-height: 350px">
            <button class="asset inline-block pt-[9px] pb-[19px] px-[11px] border border-solid border-transparent mb-3 rounded" onclick={() => goto("/ide/newplace")}>
                <div class="w-[140px] h-[140px] border border-gray">
                    <img class="object-contain w-[140px] h-[140px]" src="/images/ide/newplace.png" alt="Create New" />
                </div>

                <p class="mt-[4px] text-[14px] w-[140px] font-semibold truncate text-center">(Create New)</p>
            </button>
            {#each data.assets as asset}
                <Asset id={asset.id} name={asset.name} width={140} height={140} />
            {/each}
        </div>
    </div>

    <div class="fixed bg-white bottom-0 divider-top w-full">
        <div class="mx-[19px] mt-[10px] mb-[12px]">
            <Button type="negative" text="Cancel" size="medium" onclick={() => window.close()} />
        </div>
    </div>
</div>