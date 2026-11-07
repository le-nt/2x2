<script lang="ts">
    import UserAd from "@components/UserAd.svelte";
    import Dropdown from "@components/Dropdown.svelte";
    import { AssetGenre } from "@/types/types";
    import Row from "./Row.svelte";
    import { setTitle } from "@client/stores";

    const categorySort = {
        "Default":"Default",
        "Popular": "Popular",
        "Top Rated": "TopRated",
        "Featured": "Featured"
    };
    const genreSort = {
        "All": AssetGenre.All,
        "Adventure": AssetGenre.Adventure,
        "Building": AssetGenre.Building,
        "Comedy": AssetGenre.Comedy,
        "Fighting": AssetGenre.Fighting,
        "FPS": AssetGenre.FPS,
        "Horror": AssetGenre.Horror,
        "Medieval": AssetGenre.Medieval,
        "Military": AssetGenre.Military,
        "Naval": AssetGenre.Naval,
        "RPG": AssetGenre.RPG,
        "Sci-Fi": AssetGenre.SciFi,
        "Sports": AssetGenre.Sports,
        "Town and City": AssetGenre.TownAndCity,
        "Western": AssetGenre.Western
    }

    let categoryValue = $state("Default");
    let genreValue = $state(AssetGenre.All);    
    setTitle("Games - ROBLOX");
</script>

<div class="flex">
    <div class="w-full flex flex-col min-[1024px]:mr-[10px]">
        <div class="ml-[14px] flex flex-row mb-[15px] h-[38px]">
            <Dropdown class="xs:w-[138px] mr-10" values={categorySort} bind:current={categoryValue} />
            <Dropdown class="xs:w-[138px]" values={genreSort} bind:current={genreValue} />
        </div>

        <div class="ml-[11px] mt-9.5">
            <Row categoryName="Popular" categoryId="Popular" />
            <Row categoryName="Top Rated" categoryId="TopRated" />
            <Row categoryName="Featured" categoryId="Featured" />
        </div>
    </div>

    <div class="min-[1024px]:flex flex-col hidden mx-4 mt-14">
        <UserAd type="rectangle" />
        <UserAd type="rectangle" class="mt-2" />
    </div>
</div>

<svelte:head>
    <style>
        .content {
            max-width: none !important;
        }

        @media (min-width: 1688px) {
            .logged-in.content {
                margin-left: 180px !important;
            }
        }
    </style>
</svelte:head>