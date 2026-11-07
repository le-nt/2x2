<script lang="ts">
    import Button from "@components/legacy/Button.svelte";
    import TopLinks from "../TopLinks.svelte";
    import { getCategoryName, formatDate } from "../+layout.svelte";
    import { setTitle } from "@client/stores";

    let { data } = $props();
    let formattedTime = new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	}).format(new Date());

    const categories = [
        "ROBLOX",
        "Club Houses",
        "Game Creation and Development",
        "Entertainment"
    ];

    const groupedForums = categories.map((category) => ({
        name: category,
        forums: data.forums.filter((f: any) => getCategoryName(f.category) === category)
    }))

    setTitle("Forum - ROBLOX");
</script>

<TopLinks />

<div class="justify-between flex items-start mt-[20px] mb-[7px]">
    <div class="mt-[3px]">
        <span class="text-small-bold">Current time: </span>
        <span class="text-small">{formattedTime}</span>
    </div>

    <div class="flex items-start">
        <span class="text-small-bold mt-[2px] mr-[2px]">Search Roblox Forums: </span>
        <input type="text" maxlength="50" class="h-[18px] mr-1 search-input">
        <Button size="medium" type="control" text="Go" class="!text-[14px] !h-[20px] !mt-auto" />
    </div>
</div>

{#each groupedForums as group (group.name)}
    <div class="flex flex-col w-full">
        <div class="flex flex-row w-full bg-[#2D528F]">
            <div class="w-full py-[8px] pl-[5px]">
                <span class="table-title">{group.name}</span>
            </div>

            <div class="w-[17%] table-header-section">
                <span class="table-title">Threads</span>
            </div>

            <div class="w-[13%] table-header-section">
                <span class="table-title">Posts</span>
            </div>

            <div class="w-[22%] table-header-section">
                <span class="table-title">Last Post</span>
            </div>
        </div>

        {#each group.forums as forum (forum.id)}
            <div class="flex flex-row w-full forum hover:bg-[#e9e9e9]">
                <a href="/Forum/ShowForum.aspx?ForumID={forum.id}" class="w-full py-[6px] pl-[5px] flex flex-col">
                    <span class="font-bold text-[#343434]">{forum.name}</span>
                    <div class="font-normal text-[#343434] max-w-[492px] leading-[20px]">{forum.description}</div>
                </a>

                <div class="w-[17%] flex">
                    <span class="text-smaller m-auto">{forum.threadsCount}</span>
                </div>

                <div class="w-[13%] flex">
                    <span class="text-smaller m-auto">{forum.postsCount}</span>
                </div>

                <div class="w-[22%] flex">
                    <div class="m-auto flex flex-col text-center">
                        {#if forum.newestActivity}
                            {#if forum.newestActivity.createdAt}
                                <span class="text-smaller"><b>{formatDate(forum.newestActivity.createdAt)}</b></span>
                            {/if}
                            {#if forum.newestActivity.createdByUser?.username}
                                <span class="text-smaller">{forum.newestActivity.createdByUser.username}</span>
                            {/if}
                        {/if}
                    </div>
                </div>
            </div>
        {/each}
    </div>
{/each}

<style>
    .table-header-section {
        display: flex;
        border-left: 1px solid #ccc;
        border-top: none;
        height: 100%;
    }

    .forum {
        border-top: 1px solid #ccc;
    }
</style>