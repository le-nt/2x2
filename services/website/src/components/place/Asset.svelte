<script lang="ts">
    import { ThumbnailType } from "@/types/thumb";
    import Thumbnail from "@components/Thumbnail.svelte";
    let { id, name, selected = false, onToggle } = $props();
</script>

<button
    class={`inline-block pt-[9px] pb-[19px] px-[14px] h-[128px] border border-solid hover:border-[#a7a7a7] ${
        selected ? "border-[#a7a7a7]" : "border-transparent"
    }`}
    onclick={onToggle}
>
    <div class="border border-gray" style="width: 197px; height: 115px">
        <Thumbnail {id} type={ThumbnailType.Place} width={210} height={115} />
    </div>

    <p class="mt-[4px] mx-[12px] mb-[12px] text-[13px] font-bold font-semibold truncate text-center">
        {name}
    </p>
</button>
