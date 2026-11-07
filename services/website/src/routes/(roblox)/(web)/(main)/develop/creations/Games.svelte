<script lang="ts">
    import { ThumbnailType } from "@/types/thumb";
    import { api } from "@client/api";
    import { encode } from "@client/url";
    import Thumbnail from "@components/Thumbnail.svelte";

    type Game = {
        id: number;
        name: string;
        placeId: number;
    };

    let games: Game[] = $state([]);
    let openConfigId: number | null = $state(null);

    async function loadGames() {
        const res = await api.develop.listGames.get(fetch);
        games = res.data.data;
    }

    $effect(() => {
        loadGames();
    });
</script>

<h2>Games</h2>

<div class="flex flex-col mt-[24px]">
    {#each games as game}
        <div class="flex flex-col">
            <div class="flex flex-row">
                <div class="w-[80px] text-center">
                    <a href={`/universes/configure?id=${game.id}`} class="h-[69px] block w-[70px]">
                        <Thumbnail id={game.placeId} type={ThumbnailType.Place} width={240} height={240} />
                    </a>
                </div>
                <div class="w-[300px] flex flex-col justify-center my-auto text-[13px]">
                    <a class="text-[14px]" href={`/universes/configure?id=${game.id}`}>{game.name}</a>
                    <div class="mt-[1px]">
                        <span class="text-[#999] mr-[5px] font-medium text-[13px]">Start Place:</span>
                        <a href="/games/{game.id}/{encode(game.name)}">{game.name}</a>
                    </div>
                </div>
                <div class="flex flex-row ml-auto items-center relative">
                    <div class="gear-button-wrapper" class:open={openConfigId === game.id}>
                        <button
                            class="gear-button"
                            class:open={openConfigId === game.id}
                            aria-label="Open Config"
                            onclick={() =>  openConfigId = openConfigId === game.id ? null : game.id}>
                        </button>
                        {#if openConfigId === game.id}
                            <div class="configure-menu">
                                <a href={`/universes/configure?id=${game.id}`}>Configure Place</a>
                                <a href={`/My/NewUserAd.aspx?targetId=${game.id}&targettype=Asset`}>Advertise</a>
                                <a href={`/develop?selectedPlaceId=${game.id}&View=21`}>Create Badge</a>
                                <a href={`/develop?selectedPlaceId=${game.id}&View=34`}>Create Game Pass</a>
                                <a href="/catalog/browse.aspx?Category=5&showInstructions=true">Add Gear</a>
                                <a href={`/places/${game.id}/stats`} class="divider-top">Developer Stats</a>
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