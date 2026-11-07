<script lang="ts">
    let {
        type,
        class: additionalClasses = ''
    }: {
        type: "rectangle" | "banner" | "skyscraper";
        class?: string
    } = $props();

    let width = $state(0);
    let height = $state(0);
    let imageUrl = $state("");

    switch (type) {
        case "rectangle":
            width = 300;
            height = 250;
            imageUrl = "/images/ads/sampleAd1.jpg";
            break;
        case "banner":
            width = 728;
            height = 90;
            imageUrl = "/images/ads/sampleAd2.jpg";
            break;
        case "skyscraper":
            width = 160;
            height = 600;
            imageUrl = "/images/ads/sampleAd3.jpg";
            break;
    }
</script>

<div class="text-center leading-[1.25] bg-transparent flex flex-col {additionalClasses}" style="width: {width}px">
    <a title="Get Builders Club and Be Rich on ROBLOX" href="#top">
        <img src={imageUrl} alt="Get Builders Club and Be Rich on ROBLOX" height={height} width={width} />
    </a>

    <div class="flex flex-row justify-between" style="width: {width}px">
        <span class="text-[#ccc] text-[12px] leading-[10px] font-normal">Advertisement</span>
        <a class="hover:!text-[#d86868] !text-[#ccc] text-[12px] leading-[10px]" href="#top" title="click to report an offensive ad">Report</a>
    </div>
</div>