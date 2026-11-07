<script>
    import { Tabs } from "bits-ui";
    import { goto } from "$app/navigation";
    import UserAd from "@components/UserAd.svelte";
    import Places from "./Places.svelte";
    import Games from "./Games.svelte";

    let tabs = [
        { name: "Places", query: "View", value: "9", component: Places },
        { name: "Games", query: "Page", value: "universes", component: Games },
        { name: "Models", query: "View", value: "10" },
        { name: "Decals", query: "View", value: "13" },
        { name: "Badges", query: "View", value: "21" },
        { name: "Game Passes", query: "Page", value: "game-passes" },
        { name: "Audio", query: "View", value: "3" },
        { name: "Animations", query: "View", value: "24" },
        { name: "Meshes", query: "View", value: "40" },
        { name: "User Ads", query: "Page", value: "ads" },
        { name: "Sponsored Games", query: "Page", value: "sponsored-games" },
        { name: "Shirts", query: "View", value: "11" },
        { name: "T-Shirts", query: "View", value: "2" },
        { name: "Pants", query: "View", value: "12" },
        { name: "Plugins", query: "View", value: "38" }
    ];
</script>

<Tabs.Root value="places" orientation="vertical" class="mt-[10px] tabs-legacy">
    <Tabs.List class="border-r border-r-solid border-r-[#CCC] h-[738px] ml-[15px] mt-[10px]">
        {#each tabs as tab}
            <Tabs.Trigger
                value={tab.name.toLowerCase().replace(/\s+/g, "")}
                onclick={() => goto(`/develop?${tab.query}=${tab.value}`)}
            >
                {tab.name}
            </Tabs.Trigger>
        {/each}
        <div class="border-[1px] border-[#ccc] border-solid my-[15px] h-[90px] w-[136px]">
            <div class="text-center bg-[#efefef]">
                <span class="text-[15px] font-semibold">ROBLOX Studio</span>
            </div>
            <div class="flex flex-row mt-3">
                <img class="w-[50px] h-[50px] mr-[5px] ml-[10px]" src="/images/BuildPage/RobloxStudio.png" alt="ROBLOX Studio">
                <div class="flex flex-col mt-1">
                    <a href="https://files.bamar.rocks/share/kojjivarn86e/RobloxStudioQT6-Win7-x86_64-v1.7z">Download</a>
                    <a class="mt-0.5" href="https://www.robloxdev.com/">Visit Wiki</a>
                </div>
            </div>
        </div>
    </Tabs.List>

    {#each tabs as tab}
        {#if tab.component}
            <Tabs.Content
                value={tab.name.toLowerCase().replace(/\s+/g, "")}
                class="pt-[9px] pb-[10px] px-[10px] mt-3 border-r-[1px] w-[622px] border-r-solid border-r-[#ccc]"
            >
                <svelte:component this={tab.component} />
            </Tabs.Content>
        {/if}
    {/each}

    <div class="ml-auto mr-[1px] mt-3">
        <UserAd type="skyscraper" />
    </div>
</Tabs.Root>