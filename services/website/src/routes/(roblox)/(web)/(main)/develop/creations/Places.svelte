<script lang="ts">
    import { ThumbnailType } from "@/types/thumb";
    import { api } from "@client/api";
    import Button from "@components/legacy/Button.svelte";
    import Thumbnail from "@components/Thumbnail.svelte";

    type Place = {
        id: number;
        asset: {
            name: string;
            updatedAt: string;
        };
        startPlaceId: number;
        visits: number;
        last7Days: number;
        image?: string;
    };

    let sortBy: number | undefined = $state();
    let showActiveOnly = $state(false);
    let openConfigId: number | null = $state(null);
    let places: Place[] = $state([]);

    async function loadPlaces() {
        const res = await api.develop.listPlaces.get(fetch, {
            query: { sortBy: String(sortBy), includeInactivePlaces: !showActiveOnly }
        });
        places = res.data.data;
    }

    $effect(() => {
        loadPlaces();
    });
</script>

<Button href="/places/create" type="primary" size="medium" text="Create New Place" />
<div class="flex flex-row items-start mt-2.5 w-full">
    <h2>Places</h2>
    <span class="mt-[17px] ml-3 text-[#999] font-medium text-[12px]">0 of 100 active slots used</span>
    <div class="ml-auto flex flex-col mt-3.5">
        <div class="flex flex-row ml-auto">
            <span class="font-semibold mr-0.5 text-[14px]">Created by:</span>
            <select class="form-select w-[130px]" bind:value={sortBy}>
                <option value="0">Me</option>
                <option value="1">My Games</option>
                <option value="2">Other Games</option>
            </select>
        </div>
        <label class="text-[12px] text-black mt-3.5 font-normal flex justify-right">
            <input type="checkbox" class="mr-1 mb-0.5" bind:checked={showActiveOnly}>Show Active Only
        </label>
    </div>
</div>

<div class="flex flex-col mt-[24px]">
    {#each places as place}
        <div class="flex flex-col">
            <div class="flex flex-row">
                <div class="w-[80px] text-center">
                    <a href={`/universes/configure?id=${place.id}`} class="h-[69px] block w-[70px]">
                        <Thumbnail id={place.id} type={ThumbnailType.Place} width={240} height={240} />
                    </a>
                </div>
                <div class="w-[300px] flex flex-col pt-[0.7rem] text-[13px]">
                    <a class="text-[14px]" href={`/universes/configure?id=${place.id}`}>{place.asset.name}</a>
                    <div class="flex items-center mt-1 text-[13px]">
                        <a class="place-active" href={`/universes/configure?id=${place.id}`}>Active</a>
                        <span class="text-[#999] ml-8.5 font-normal pt-[1px]">Updated: {new Date(place.asset.updatedAt).toLocaleDateString('en-US')}</span>
                    </div>
                </div>
                <div class="flex flex-col text-[13px] text-[#999] font-normal mt-[17px]">
                    <span>Total Visitors: <span class="!text-black ml-[1px]">{place.visits}</span></span>
                    <span>Last 7 days: <span class="!text-black ml-[1px]">{place.last7Days}</span></span>
                </div>
                <div class="flex flex-row ml-auto items-center relative">
                    <Button type="control" size="large" text="Edit" />
                    <div class="gear-button-wrapper" class:open={openConfigId === place.id}>
                        <button
                            class="gear-button"
                            class:open={openConfigId === place.id}
                            aria-label="Open Config"
                            onclick={() =>  openConfigId = openConfigId === place.id ? null : place.id}>
                        </button>
                        {#if openConfigId === place.id}
                            <div class="configure-menu">
                                <a href={`/universes/configure?id=${place.id}`}>Configure Place</a>
                                <a href={`/My/NewUserAd.aspx?targetId=${place.id}&targettype=Asset`}>Advertise</a>
                                <a href={`/develop?selectedPlaceId=${place.id}&View=21`}>Create Badge</a>
                                <a href={`/develop?selectedPlaceId=${place.id}&View=34`}>Create Game Pass</a>
                                <a href="/catalog/browse.aspx?Category=5&showInstructions=true">Add Gear</a>
                                <a href={`/places/${place.id}/stats`} class="divider-top">Developer Stats</a>
                                <a href="#">Build</a>
                                <a href="#">Shut Down All Instances</a>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
        <div class="separator"></div>
    {/each}
</div>

<style>
    a.place-active:hover {
        background-position: 0 -15px;
        text-decoration: none;
    }
    
    a.place-active, a.place-inactive, span.inactive-image {
        padding-left: 18px;
        font-size: 13px;
        background-image: url("/images/BuildPage/ico-game_status3.png");
        background-repeat: no-repeat;
        display: block;
        height: 16px;
        width: 60px;
        font-weight: 500;
    }

    a.place-active {
        color: #006f00;
    }
</style>