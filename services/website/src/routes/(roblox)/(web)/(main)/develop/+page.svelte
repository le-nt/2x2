<script>
    import UserAd from "@components/UserAd.svelte";
    import Creations from "./creations/Main.svelte";
    import { Tabs } from "bits-ui";
    import "@components/css/page/develop.css"
</script>

<div class="!w-[985px]">
    <div class="w-full hidden min-[729px]:flex justify-center mb-[10px]">
        <UserAd type="banner" />
    </div>

    <Tabs.Root value="myCreations" class="mt-[24px] tabs-legacy">
        <Tabs.List>
            <Tabs.Trigger value="myCreations">My Creations</Tabs.Trigger>
            <!-- <Tabs.Trigger value="groupCreations">Group Creations</Tabs.Trigger> -->
            <Tabs.Trigger value="library">Library</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="myCreations" class="relative top-[-1px] border-t-[1px] border-t-solid border-t-[#ccc]">
            <Creations />
        </Tabs.Content>
        <!--
        <Tabs.Content value="groupCreations" class="relative top-[-1px] border-t-[1px] border-t-solid border-t-[#ccc]">
            
        </Tabs.Content>
        -->
        <Tabs.Content value="library" class="relative top-[-1px] border-t-[1px] border-t-solid border-t-[#ccc]">
            
        </Tabs.Content>
    </Tabs.Root>
</div>