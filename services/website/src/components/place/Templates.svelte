<script>
    import { Tabs } from "bits-ui";
    import Asset from "./Asset.svelte";

    let { data, templateId = $bindable() } = $props();
</script>

<h2 class="text-[16px] font-bold !p-0 !m-0">Templates</h2>
<Tabs.Root value="basic" class="tabs-pills mt-5">
    <Tabs.List class="mb-3">
        <Tabs.Trigger value="basic">Basic</Tabs.Trigger>
        <Tabs.Trigger value="theme">Theme</Tabs.Trigger>
        <Tabs.Trigger value="gameplay">Gameplay</Tabs.Trigger>
    </Tabs.List>

    <Tabs.Content value="basic">
        {#each data.filter(t => t.type === "basic") as item}
            <Asset
                id={item.id}
                name={item.name}
                selected={templateId === item.id}
                onToggle={() => templateId = item.id}
            />
        {/each}
    </Tabs.Content>

    <Tabs.Content value="theme">
        {#each data.filter(t => t.type === "theme") as item}
            <Asset
                id={item.id}
                name={item.name}
                selected={templateId === item.id}
                onToggle={() => templateId = item.id}
            />
        {/each}
    </Tabs.Content>

    <Tabs.Content value="gameplay">
        {#each data.filter(t => t.type === "gameplay") as item}
            <Asset
                id={item.id}
                name={item.name}
                selected={templateId === item.id}
                onToggle={() => templateId = item.id}
            />
        {/each}
    </Tabs.Content>
</Tabs.Root>