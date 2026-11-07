<script>
    import { ThumbnailType } from "@/types/thumb";
    import { encode } from "@client/url";
    import Thumbnail from "@components/Thumbnail.svelte";

    let { content } = $props();
    let i = $state(0);
    let hovered = $state(false);

    function next() {
        i = (i + 1) % content.length;
    }

    function prev() {
        i = (i - 1 + content.length) % content.length;
    }
</script>

<div class="bg-[#118237] relative" role="presentation" onmouseenter={() => hovered = true} onmouseleave={() => hovered = false}>
    <div class="h-[300px] flex flex-row">
        <div class="w-[50%] flex">
            <a class="mx-auto mt-[10px] w-[280px] h-[280px]" href="/games/{content[i].id}/{encode(content[i].name)}">
                {#key i}
                    {#if content[i].imageUrl}
                        <img class="rounded-[12px] h-auto w-full shadow-[0_0_6px_0_rgba(0,0,0,0.49)]" src={content[i].imageUrl} alt="" />
                    {:else}
                        <Thumbnail class="rounded-[12px] h-auto w-full shadow-[0_0_6px_0_rgba(0,0,0,0.49)]" type={ThumbnailType.Place} id={content[i].id} width={352} height={352} />
                    {/if}
                {/key}
            </a>
        </div>

        <div class="w-[50%] bg-white py-[20px] pr-[50px] pl-[40px] flex flex-col box-border">
            <h2 class="overflow-hidden text-ellipsis whitespace-nowrap tracking-[0px] text-black mb-[1px]">{content[i].name}</h2>
            <p class="whitespace-prewrap overflow-hidden leading-[1.5em] pt-[5px] h-[100px] border-t-[1px] border-t-solid border-[#B8B8B8]">{content[i].description}</p>
            <div class="mt-auto mb-[17px] flex flex-row">
                <div class="flex flex-col w-[50%]">
                    <p class="text-label">{content[i].indicator1.name}</p>
                    <p class="text-lead">{content[i].indicator1.value}</p>
                </div>
                <div class="flex flex-col w-[50%]">
                    <p class="text-label">{content[i].indicator2.name}</p>
                    <p class="text-lead">{content[i].indicator2.value}</p>
                </div>
            </div>
        </div>
    </div>
    {#if content.length > 1}
        <button class="switcher-control left-[18px]" aria-label="Left Scroll" class:!flex={hovered} onclick={prev}>
            <span class="icon-carousel-left"></span>
        </button>
        <button class="switcher-control right-[18px]" aria-label="Right Scroll" class:!flex={hovered} onclick={next}>
            <span class="icon-carousel-right"></span>
        </button>
    {/if}
</div>

<style>
    .switcher-control {
        top: calc(50% - 24px);
        border: 2px solid #fff;
        border-radius: 50%;
        display: none;
        height: 48px;
        position: absolute;
        text-align: center;
        width: 48px;
        z-index: 1000;
        background-color: rgba(25,25,25,0.3);
        transition: all,0.2s,ease-in-out;
        user-select: none;
        justify-content: center;
        align-items: center;
    }

    .switcher-control:hover {
        background-color: #191919;
        background-color: rgba(25,25,25,0.75);
    }
</style>