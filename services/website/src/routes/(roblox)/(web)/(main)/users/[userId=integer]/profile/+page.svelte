<script lang="ts">
    import { ThumbnailType } from "@/types/thumb";
    import Button from "@components/Button.svelte";
    import Thumbnail from "@components/Thumbnail.svelte";
    import UserAd from "@components/UserAd.svelte";
    import { Tabs } from "bits-ui";
    import GameCard from "../../../games/Card.svelte"
    import SlideSwitcher from "./SlideSwitcher.svelte";
    import { UserAdminTraitSafe as UserAdminTrait } from "@shared/prisma-browser";

    let { data } = $props();
    let isGridOn = $state(false);
    let profileBadges = [
        {
            name: "Administrator",
            icon: "icon-administrator",
            visible:
                (data.profile.adminStatus?.trait ?? data.profile.roleSet) === UserAdminTrait.Administrator ||
                (data.profile.adminStatus?.trait ?? data.profile.roleSet) === UserAdminTrait.SuperAdmin
        }
    ];
    
    const gameSlides = data.profile.assets.map((game: any) => ({
        id: game.id,
        name: game.name,
        description: game.description,
        indicator1: { name: "Playing", value: game.place.gameServers
            .reduce((sum: number, server: any) => sum + server.players.length, 0) ?? 0 },
        indicator2: { name: "Visits", value: game.place.visits }
    }));
    const totalPlaceVisits = data.profile.assets
        ?.reduce((sum: number, game: any) => sum + (game.place.visits ?? 0), 0) ?? 0;
    const totalForumPosts = data.profile._count.forumThreads + data.profile._count.forumPosts
</script>

<div class="w-full hidden min-[729px]:flex justify-center">
    <UserAd type="banner" />
</div>

<div class="max-w-[970px] mx-auto flex-col flex mt-2">
    <div class="section-content flex items-start max-w-[940px]">
        <div class="mr-[12px] border-solid border-[1px] border-[#B8B8B8] !w-[127px] h-[110px]">
            <Thumbnail id={1} type={ThumbnailType.AvatarHeadShot} width={100} height={100} />
        </div>

        <div class="flex flex-col items-start w-full">
            <h2>{data.profile.username}</h2>
            <span class="my-[6.5px]">"Welcome to ROBLOX, the Imagination Platform. Make friends, explore, and play games!"</span>
            <div class="flex flex-row w-full px-[1px] pt-[1px]">
                <div class="w-[41.5%] flex flex-row">
                    <div class="w-[33%] flex flex-col">
                        <div class="text-label text-center">Friends</div>
                        <a class="text-name text-center" href="/users/1/friends#!/friends">
                            <h3>0</h3>
                        </a>
                    </div>

                    <div class="w-[33%] flex flex-col">
                        <div class="text-label text-center">Followers</div>
                        <a class="text-name text-center" href="/users/1/friends#!/followers">
                            <h3>0</h3>
                        </a>
                    </div>

                    <div class="w-[33%] flex flex-col">
                        <div class="text-label text-center">Following</div>
                        <a class="text-name text-center" href="/users/1/friends#!/following">
                            <h3>0</h3>
                        </a>
                    </div>
                </div>

                {#if data.user?.id !== data.profile.id}
                    <div class="ml-auto">
                        <Button type="control" text="Message" size="sm" class="!py-[9px] !px-[24px] !text-[1.125em] mx-[4px]" />
                        <Button type="control" text="Add Friend" size="sm" class="!py-[9px] !px-[24px] !text-[1.125em] mx-[4px]" />
                    </div>
                {/if}
            </div>
        </div>
    </div>

    <Tabs.Root value="about" class="mt-[18px] tabs-modern">
        <Tabs.List>
            <Tabs.Trigger value="about">About</Tabs.Trigger>
            <Tabs.Trigger value="creations">Creations</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="about" class="mt-2">
            <h3>About</h3>
            <div class="section-content max-w-[940px] mt-1.5">
                <p class="pb-[5.5px]">
                    <span class="whitespace-pre-wrap tracking-[0.01px]">{data.profile.about}</span>
                </p>

                <div class="pt-[5px] border-t-[1px] border-t-solid border-[#B8B8B8] flex">
                    <a href="#top" class="ml-auto !text-[12px] !font-[400] !text-[#D86868] pt-[1.5px]">Report Abuse</a>
                </div>
            </div>

            <h3 class="mt-4.5">Currently Wearing</h3>
            <div class="flex flex-row w-full h-[300px]">
                <div class="w-[50%] bg-white px-[12px]">
                    <div class="flex mx-auto w-[300px] h-[300px]">
                        <Thumbnail type={ThumbnailType.Avatar} width={352} height={352} id={1} />
                    </div>
                </div>
                <div class="w-[50%] bg-[#0074BD]">
                </div>
            </div>

            {#if profileBadges.filter(b => b.visible).length > 0}
                <h3 class="mt-4.5">Roblox Badges ({profileBadges.filter(b => b.visible).length})</h3>
                <div class="section-content !px-[22px] mt-1 flex gap-2">
                    {#each profileBadges.filter(b => b.visible) as badge}
                        <div class="flex flex-col py-[5px]">
                            <span class="{badge.icon} border-solid border-[1px] border-[#B8B8B8]" title={badge.name}></span>
                            <span>{badge.name}</span>
                        </div>
                    {/each}
                </div>
            {/if}

            <h3 class="mt-4.5">Statistics</h3>
            <div class="section-content flex max-w-[940px]">
                <div class="w-[33.33333%] text-center">
                    <p class="text-label">Join Date</p>
                    <p class="text-lead">{new Date(data.profile.createdAt).toLocaleDateString("en-US")}</p>
                </div>
                <div class="w-[33.33333%] text-center">
                    <p class="text-label">Place Visits</p>
                    <p class="text-lead">{totalPlaceVisits.toLocaleString()}</p>
                </div>
                <div class="w-[33.33333%] text-center">
                    <p class="text-label">Forum Posts</p>
                    <p class="text-lead">{totalForumPosts.toLocaleString()}</p>
                </div>
            </div>
        </Tabs.Content>
        <Tabs.Content value="creations" class="mt-1.5">
            <div class="mb-1.5 flex">
                <h3>Games</h3>
                <div class="ml-auto flex">
                    {#key isGridOn}
                        <Button type={isGridOn ? "control" : "secondary"} size="xs" text={`<span class="icon-slideshow ${isGridOn ? "" : "selected"}"></span>`} class="!pt-[2px] !pb-0 !h-[32px] !px-[20px] mr-1" onclick={() => isGridOn = false} />
                        <Button type={isGridOn ? "secondary" : "control"} size="xs" text={`<span class="icon-grid ${!isGridOn ? "" : "selected"}"></span>`} class="!pt-[2px] !pb-0 !h-[32px] !px-[20px]" onclick={() => isGridOn = true} />
                    {/key}
                </div>
            </div>
            {#if isGridOn}
                <div class="whitespace-nowrap">
                    {#each data.profile.assets as game}
                        <div class="w-[16.66667%] min-w-[140px] float-left h-[221px] mb-[12px]">
                            <GameCard
                                id={game.id}
                                name={game.name}
                                playing={game.place.gameServers
                                    .reduce((sum: number, server: any) => sum + server.players.length, 0) ?? 0}
                                likes={game.place.likes.length}
                                dislikes={game.place.dislikes.length}
                                creatorName={data.profile.username}
                                creatorUrl={`/users/${data.profile.id}/profile`}
                                class="!pl-[6px] !pr-[6px] !pb-[6px] !pt-[9px]"
                                mainClass="!w-[152px]"
                            />
                        </div>
                    {/each}
                </div>
            {:else if gameSlides.length !== 0}
                <SlideSwitcher content={gameSlides} />
            {/if}
        </Tabs.Content>
    </Tabs.Root>
</div>

<div class="w-full hidden min-[990px]:flex justify-center mt-6 mb-8.5">
    <UserAd type="rectangle" class="mr-13" />
    <UserAd type="rectangle" />
</div>

<style>
    h2 {
        letter-spacing: 0px;
    }
</style>