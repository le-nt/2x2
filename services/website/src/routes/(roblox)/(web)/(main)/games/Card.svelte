<script>
    import { ThumbnailType } from "@/types/thumb";
    import { encode } from "@client/url";
    import Thumbnail from "@components/Thumbnail.svelte";
    
    let {
        name,
        id,
        playing,
        likes,
        dislikes,
        creatorName,
        creatorUrl,
        class: extraClass = '',
        mainClass = ''
    } = $props();
    const likeRatio = (likes / (likes + dislikes)) * 100;
</script>

<div class="main-card shadow-[0_1px_3px_rgba(150,150,150,0.74)] float-none !mx-[4px] rounded-[3px] align-top hover:z-[498] inline-block p-0 h-[100%] w-[158px] group relative {mainClass}">
    <a href="/games/{id}/{encode(name)}" class="game-item flex flex-col {extraClass}" aria-label="Game Card">
        <div class="w-auto h-[140px]">
            <Thumbnail type={ThumbnailType.Place} {id} height={140} width={140} />
        </div>
        <span class="font-light text-[16px] mt-1.5 mr-[3px] overflow-hidden text-ellipsis text-black">
            {name}
        </span>
        <span class="mr-[3px] text-[#757575] text-[12px] font-normal">{playing} Playing</span>
        <div class="mt-[3px] w-full flex flex-row items-center">
            <span class="icon-thumbs-up"></span>

            <div class="ml-auto mr-auto h-[6px] w-[100px] relative">
                <div class="voting-background w-full absolute top-0 left-0"></div>
                <div class="votes absolute top-0 left-0" style="width: {likeRatio}%;"></div>
            </div>

            <span class="icon-thumbs-down invisible group-hover:visible"></span>
        </div>
        <div class="hidden group-hover:flex justify-between mb-[2px] mt-[-3px]">
            <span class="text-[#02b757] text-[12px] font-normal">{likes}</span>
            <span class="text-[#E27676] text-[12px] font-normal">{dislikes}</span>
        </div>
    </a>

    <div class="hidden group-hover:block group-hover:float-left w-full rounded-[3px] z-[499] pb-[5px] bg-white">
        <div class="developer-divider"></div>
        <span class="text-label text-[12px] ml-[8px] mb-[5px]">By <a class="!text-[#00A2FF] hover:underline" href={creatorUrl}>{creatorName}</a></span>
    </div>
</div>

<style>
    .developer-divider {
        width: 90%;
        margin-left: 8px;
        border-top: 1px solid #E3E3E3;
        padding-left: 2px;
        padding-top: 5px;
        padding-bottom: 1px;
    }

    .voting-background, .votes {
        height: 100%;
    }

    .voting-background {
        background-image: repeating-linear-gradient(
            to right,
            #B8B8B8,
            #B8B8B8 19px,
            transparent 19px,
            transparent 21px
        );
        z-index: 0;
    }

    .main-card:hover .voting-background {
        background-image: repeating-linear-gradient(
            to right,
            #E27676,
            #E27676 19px,
            transparent 19px,
            transparent 21px
        );
    }

    .main-card:hover .votes {
        background-image: repeating-linear-gradient(
            to right,
            #02b757,
            #02b757 19px,
            transparent 19px,
            transparent 21px
        );
    }

    .votes {
        background-image: repeating-linear-gradient(
            to right,
            #757575,
            #757575 19px,
            transparent 19px,
            transparent 21px
        );
        z-index: 1;
    }

    .game-item {
        position: relative;
        text-align: left;
        float: left;
        background-color: #fff;
        border-radius: 3px;
        min-height: 221px;
        padding: 9px 9px 6px 9px;
        width: 100%;
        margin: 0 auto;
        box-sizing: border-box;
    }

    .main-card:hover .game-item {
        padding-bottom: 0px !important;
    }

    @media (min-width: 480px) {
        .icon-thumbs-up {
            background-position: 0 0 !important;
            background-size: 32px auto !important;
            width: 16px !important;
            height: 16px !important;
        }
    }

    .icon-thumbs-up {
        background-position: 0 0;
        background-size: 24px auto;
        width: 12px;
        height: 12px;
    }

    @media (min-width: 480px) {
        .icon-thumbs-down {
            background-position: 0 -16px !important;
            background-size: 32px auto !important;
            width: 16px !important;
            height: 16px !important;
        }
    }

    .icon-thumbs-down {
        background-position: 0 -12px;
        background-size: 24px auto;
        width: 12px;
        height: 12px;
        opacity: .6;
    }
</style>