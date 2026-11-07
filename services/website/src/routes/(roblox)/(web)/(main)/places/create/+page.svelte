<script lang="ts">
    import { AssetCategory, AssetGenre } from "@/types/types";
    import Button from "@components/legacy/Button.svelte";
    import { Tabs } from "bits-ui";
    import { ChatStyleSafe as ChatStyle, DeviceSafe as Device } from "@shared/prisma-browser";
    import { api } from "@client/api";
    import { goto } from "$app/navigation";

    import Access from "@components/place/Access.svelte";
    import BasicSettings from "@components/place/BasicSettings.svelte";
    import Templates from "@components/place/Templates.svelte";
    import AdvancedSettings from "@components/place/AdvancedSettings.svelte";

    let { data } = $props();

    let name = $state(`${data.user?.username}'s Place Number: ${data.placeCount + 1}`);
    let description = $state("");
    let genre = $state(AssetGenre.All);
    let templateId = $state(data.templates.find(t => t.type === "basic")?.id)

    let playableDevices = $state([Device.Computer, Device.Phone, Device.Tablet]);
    let isBuildServer = $state(false);
    let maxPlayers = $state(10);

    let vipEnabled = $state(true);
    let vipPrice = $state(100);

    let allowAnyGearGenre = $state(true);
    let allowedGearCategories: AssetCategory[] = $state([])

    let chatType = $state(ChatStyle.Classic);
    let copyLocked = $state(true);
    let commentsAllowed = $state(true);

    async function createPlace() {
        const { error } = await api.develop.createPlace.post(fetch, {
            body: {
                name,
                description,
                genre,
                templateId,
                playableDevices,
                isBuildServer,
                maxPlayers,
                vipEnabled,
                vipPrice,
                allowAnyGearGenre,
                allowedGearCategories,
                chatType,
                copyLocked,
                commentsAllowed
            }
        })
        if (error) {
            alert(error.value);
            return;
        }
        goto("/develop");
    }
</script>

<h1>Create Place</h1>

<Tabs.Root value="templates" class="tabs-legacy">
    <Tabs.List>
        <Tabs.Trigger value="templates">Templates</Tabs.Trigger>
        <Tabs.Trigger value="basicSettings">Basic Settings</Tabs.Trigger>
        <Tabs.Trigger value="access">Access</Tabs.Trigger>
        <Tabs.Trigger value="advancedSettings">Advanced Settings</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="templates" class="pr-[15px] pl-[10px] pb-[21px] pt-[20px] relative top-[-1px] border-t-[1px] border-t-solid border-t-[#ccc]">
        <Templates data={data.templates} bind:templateId={templateId} />
    </Tabs.Content>
    <Tabs.Content value="basicSettings" class="pr-[15px] pl-[10px] pb-[21px] pt-[20px] relative top-[-1px] border-t-[1px] border-t-solid border-t-[#ccc]">
        <BasicSettings
            bind:name={name}
            bind:description={description}
            bind:genre={genre}
        />
    </Tabs.Content>
    <Tabs.Content value="access" class="pr-[15px] pl-[10px] pb-[21px] pt-[20px] relative top-[-1px] border-t-[1px] border-t-solid border-t-[#ccc]">
        <Access
            bind:playableDevices={playableDevices}
            bind:isBuildServer={isBuildServer}
            bind:maxPlayers={maxPlayers}
            bind:vipEnabled={vipEnabled}
            bind:vipPrice={vipPrice}
        />
    </Tabs.Content>
    <Tabs.Content value="advancedSettings" class="pr-[15px] pl-[10px] pb-[21px] pt-[20px] relative top-[-1px] border-t-[1px] border-t-solid border-t-[#ccc]">
        <AdvancedSettings
            bind:allowAnyGearGenre={allowAnyGearGenre}
            bind:allowedGearCategories={allowedGearCategories}
            bind:chatType={chatType}
            bind:copyLocked={copyLocked}
            bind:commentsAllowed={commentsAllowed}
        />
    </Tabs.Content>
    <div class="my-[20px] ml-[9px] flex">
        <Button type="primary" text="Create Place" size="medium" class="mr-[10px]" onclick={createPlace} />
        <Button type="negative" href="/develop" text="Cancel" size="medium" class="mr-[10px]" />
    </div>
</Tabs.Root>

<style>
    h1 {
        font-size: 32px;
        font-weight: bold;
        margin: 12px;
        color: #343434;
        letter-spacing: -1px;
    }
</style>