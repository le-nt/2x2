<script lang="ts">
    import { getRobloxObject } from "@client/qwebchannel"
    import Button from "@components/legacy/Button.svelte";
    import { Tabs } from "bits-ui";
    import { onMount } from "svelte";
    import { goto, invalidateAll } from "$app/navigation";

    let selectedTab = $state("basic");
    let { data } = $props();

    async function logOut() {
        await fetch("/api/users/log-out");
        await invalidateAll();
    }

    onMount(async () => {
        const roblox = await getRobloxObject();
    })
</script>

<div class="h-full relative">
    <div class="h-[84px] flex items-start bg-[url(/images/ide/bg-header.png)]">
        <img class="ml-[9px] mt-[16px]" src="/images/ide/logo-header.png" alt="Roblox Studio Title">
        <div class="h-full flex">
            <a href="/develop" class="text-link mt-12.5 ml-8">Switch to Classic View</a>
        </div>
        <div class="h-full flex items-center ml-auto">
            {#if data.user}
                <span class="text-[16px] font-[Arial] mx-[20px]">Logged in as {data.user.username}</span>
                <Button type="control" size="large" text="Logout" onclick={logOut} class="!font-bold mr-[10px]" />
            {:else}
                <Button type="control" size="large" onclick={() => goto("/")} text="Sign Up" class="!font-bold mr-[5px]" />
                <span class="text-[13px] font-[Arial] mx-[7px]">or</span>
                <Button type="control" size="large" text="Login ▼" class="ml-[5px] mr-[10px]" />
            {/if}
        </div>
    </div>

    <div class="font-[Arial]">
        <Tabs.Root value="newProject" orientation="vertical" class="mt-[10px] tabs-legacy">
            <Tabs.List class="border-r border-r-solid border-r-[#CCC] h-[864px] ml-[15px] mt-[10px]">
                <Tabs.Trigger value="newProject" class="!font-light !py-0 !pl-3.5 !w-auto !leading-[30px]">New Project</Tabs.Trigger>
                <Tabs.Trigger value="games" class="!font-light !py-0 !pl-3.5 !w-auto !leading-[30px]">Games</Tabs.Trigger>
                <Tabs.Trigger value="myProjects" class="!font-light !py-0 !pl-3.5 !w-auto !pr-12 !leading-[30px]">My Projects</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="newProject" class="select-none mt-7 ml-4">
                <h2 class="font-bold text-[16px] ml-[4px]">GAME TEMPLATES</h2>
                <div class="flex flex-row ml-1 mt-4">
                    <button class="tab-btn" class:selected={selectedTab == "basic"} onclick={() => selectedTab = "basic"}>Basic</button>
                    <button class="tab-btn" class:selected={selectedTab == "theme"} onclick={() => selectedTab = "theme"}>Theme</button>
                    <button class="tab-btn" class:selected={selectedTab == "gameplay"} onclick={() => selectedTab = "gameplay"}>Gameplay</button>
                </div>

                <div class="mt-[13px] min-h-[170px]">
                </div>
            </Tabs.Content>
            <Tabs.Content value="games" class="select-none mt-7 ml-4">
                <h2 class="mb-1">My Games</h2>
                {#if !data.user}
                    <span>You must be logged in to view your published projects!</span>
                {/if}
            </Tabs.Content>
            <Tabs.Content value="myProjects" class="select-none mt-7 ml-4">
                <h2 class="mb-1">My Places</h2>
                {#if !data.user}
                    <span>You must be logged in to view your published projects!</span>
                {/if}
            </Tabs.Content>
        </Tabs.Root>
    </div>
</div>

<style>
    .tab-btn {
        margin-right: 20px;
        color: #095FB5;
        cursor: pointer;
        font-size: 13px;
    }

    .tab-btn:hover {
        text-decoration: underline;
    }

    .tab-btn.selected {
        font-weight: bold;
        color: black;
        cursor: text;
    }

    .tab-btn.selected:hover {
        text-decoration: none;
    }
</style>