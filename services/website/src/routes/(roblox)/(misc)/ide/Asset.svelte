<script>
    import { goto } from "$app/navigation";
    import { ThumbnailType } from "@/types/thumb";
    import Thumbnail from "@components/Thumbnail.svelte";
    let { id, name, width, height } = $props();
</script>

<button class="asset inline-block pt-[9px] pb-[19px] px-[11px] border border-solid border-transparent mb-3 rounded" onclick={() => goto(`/ide/upload?assetId=${id}`)}>
    <div class="border border-gray" style="width: {width}px; height: {height}px">
        <Thumbnail {id} type={ThumbnailType.Place} {width} {height} />
    </div>

    <p class="mt-[4px] text-[14px] font-semibold truncate text-center" style="width: {width}px">{name}</p>
</button>

<style>
    .asset:hover {
        background: url("/images/ide/bg-selected_thumb.png") repeat-x;
        border-color: #a7a7a7;
        cursor: pointer;
        background-size: 70px;
    }
</style>