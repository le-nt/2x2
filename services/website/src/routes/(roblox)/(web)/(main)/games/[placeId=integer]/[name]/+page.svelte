<script>
    import UserAd from "@components/UserAd.svelte";
    import Button from "@components/Button.svelte";
    import { AssetGenre } from "@/types/types";
    import { Tabs } from "bits-ui";
    import { setTitle } from "@client/stores";
    import Thumbnail from "@components/Thumbnail.svelte";
    import { ThumbnailType } from "@/types/thumb";

    let { data } = $props();
    setTitle(`${data.game.name} - ROBLOX`)
</script>

<div class="w-full justify-center flex">
    <UserAd type="banner" class="!hidden sm:!flex mr-[24px]" />
</div>

<div class="flex mt-1.5 w-full justify-center">
    <div class="max-w-[970px] w-full mr-5.5">
        <div class="w-full !p-[12px] min-h-[345px] bg-[#fff] flex flex-row" style="box-sizing: border-box;">
            <div class="w-[640px] h-[324px]">
                <Thumbnail type={ThumbnailType.Place} width={768} height={432} id={data.game.id} />
            </div>

            <div class="action-div">
                <div class="h-[172px] pr-[12px]">
                    <h2 class="game-name !tracking-[0px]" title={data.game.name}>{data.game.name}</h2>
                    <div>
                        <span class="text-label">By</span>
                        <a class="text-name hover:underline" href={`/users/${data.game.creatorId}/profile`}>{data.game.creatorName}</a>
                    </div>
                </div>

                <div class="play-buttons">
                    <Button class="!w-[88%] !px-0" type="primary" size="lg" text="Play" href="/games/start?placeId={data.game.id}" target="_top" />
                </div>

                <div class="flex flex-row mt-[12px] pl-1 items-start">
                    <button class="flex flex-row items-center w-[27%] mt-0.5">
                        <span class="icon-favorite mr-1"></span>
                        <span class="text-favorite mt-0.5">48K+</span>
                    </button>

                    <div class="flex flex-col w-[47%]">
                        <div class="flex justify-between w-full h-[28px] mr-1">
                            <button class="upvote flex">
                                <span class="icon-like"></span>
                                <span class="w-[6px]">{data.game.likes}</span>
                            </button>

                            <button class="downvote flex flex-row-reverse">
                                <span class="icon-dislike mr-0.5"></span>
                                <span class="w-[6px] mr-0.5">{data.game.dislikes}</span>
                            </button>
                        </div>

                        <div class="w-[138px] h-[5px] my-[6px] mx-auto">
                            <div class="vote-bg"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Tabs will go here -->
        <Tabs.Root value="about" class="mt-[8px] tabs-modern">
            <Tabs.List>
                <Tabs.Trigger value="about">About</Tabs.Trigger>
                <Tabs.Trigger value="store">Store</Tabs.Trigger>
                <Tabs.Trigger value="leaderboards">Leaderboards</Tabs.Trigger>
                <Tabs.Trigger value="servers">Servers</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="about" class="mt-1">
                <h3>Description</h3>
                <div class="section-content">
                    <p class:pb-[12px]={data.game.description.length == 0} class:mb-1={data.game.description.length !== 0}>{data.game.description}</p>
                    <div class="stats-container flex">
                        <div class="w-[16.66667%] text-center flex flex-col">
                            <p class="text-label">Visits</p>
                            <p class="text-lead">{data.game.visits}</p>
                        </div>

                        <div class="w-[16.66667%] text-center flex flex-col">
                            <p class="text-label">Created</p>
                            <p class="text-lead">{data.game.createdAt}</p>
                        </div>

                        <div class="w-[16.66667%] text-center flex flex-col">
                            <p class="text-label">Updated</p>
                            <p class="text-lead">{data.game.updatedAt}</p>
                        </div>

                        <div class="w-[16.66667%] text-center flex flex-col">
                            <p class="text-label">Max Players</p>
                            <p class="text-lead">{data.game.maxPlayers}</p>
                        </div>

                        <div class="w-[16.66667%] text-center flex flex-col">
                            <p class="text-label">Genre</p>
                            <p class="text-name font-medium">{AssetGenre[data.game.genre]}</p>
                        </div>

                        <div class="w-[16.66667%] text-center flex flex-col">
                            <p class="text-label">Allowed Gear types</p>
                            <p class="text-lead">
                                <span class="icon-nogear"></span>
                            </p>
                        </div>
                    </div>
                    <div class="w-full flex mt-[12px]">
                        <a href="#top" class="ml-auto text-error !font-light !text-[#E2231A]">Report Abuse</a>
                    </div>
                </div>
            </Tabs.Content>
        </Tabs.Root>
    </div>
    <UserAd type="skyscraper" class="!hidden sm:!flex" />
</div>

<style>
    .action-div {
        width: 36%;
        width: calc(100% - 576px);
        padding: 0 12px 0 24px;
    }

    .play-buttons {
        padding: 36px 12px;
        border-top: 1px solid #B8B8B8;
        border-bottom: 1px solid #B8B8B8;
        text-align: center;
    }

    .text-favorite {
        color: #F6B702;
        font-size: 16px;
        font-weight: 300;
    }

    .upvote span {
        color: #02b757;
    }

    .downvote span {
        color: #E2231A;
    }

    .upvote span, .downvote span {
        line-height: 28px;
    }

    .vote-bg.votes {
        border-bottom-right-radius: 4px;
        border-top-right-radius: 4px;
        background-color: #E27676;
    }

    .vote-bg {
        background-color: #B8B8B8;
        border-radius: 4px;
        height: 5px;
    }

    .stats-container {
        padding: 12px 0;
        border-top: 1px solid #E3E3E3;
        border-bottom: 1px solid #E3E3E3;
    }
</style>