<script lang="ts">
    import Button from "@components/legacy/Button.svelte";
    import TopLinks from "../TopLinks.svelte";
    import Breadcrumbs from "../Breadcrumbs.svelte";
    import { goto } from "$app/navigation";
    import { page as pageState } from "$app/state";
    import { generatePagination, formatDate } from "../+layout.svelte";

    function switchPage(page: number) {
        const params = new URLSearchParams(pageState.url.searchParams);
        params.set("Page", String(page));
        goto(`?${params}`);
    }

    let { data } = $props();
    let { page, totalPages } = $derived(data.pagination);
    let pagination = $derived(() => generatePagination(page, totalPages));
</script>

<TopLinks forum={data.forum} />

<div class="justify-between flex mt-[20px] mb-[7px]">
    <Button type="control" size="medium" text="New Thread" href="/Forum/AddPost.aspx?ForumID={data.forum.id}" />
    
    <div class="flex items-start">
        <span class="text-small-bold mt-[2px] mr-[2px]">Search this forum: </span>
        <input type="text" maxlength="50" class="h-[18px] mr-1 search-input">
        <Button size="medium" type="control" text="Go" class="!text-[14px] !h-[20px]" />
    </div>
</div>

<div class="flex flex-col w-full">
    <div class="flex flex-row w-full bg-[#2D528F]">
        <div class="w-full py-[6.5px] pl-[8px]">
            <span class="table-title">Subject</span>
        </div>

        <div class="w-[28%] table-header-section">
            <span class="table-title !mx-0 !ml-1">Author</span>
        </div>

        <div class="w-[19%] table-header-section">
            <span class="table-title">Replies</span>
        </div>

        <div class="w-[16%] table-header-section">
            <span class="table-title">Views</span>
        </div>

        <div class="w-[25.5%] table-header-section">
            <span class="table-title">Last Post</span>
        </div>
    </div>

    <div class="flex flex-col">
        {#each data.threads as thread}
            <div class="flex flex-row w-full bg-[#f9f9f9] hover:bg-[#e9e9e9] h-[44px]">
                <a href="/Forum/ShowPost.aspx?PostID={thread.id}" class="w-full py-[6px] pl-[5px] flex flex-row items-center">
                    {#if thread.hasViewed}
                        <img alt="Read" class="w-[25px] h-[20px]" src="/images/Forums/thread-read.png">
                    {:else}
                        <img alt="Unread" class="w-[25px] h-[20px]" src="/images/Forums/thread-unread.png">
                    {/if}
                    <span class="font-medium text-[#343434] ml-2">{thread.title}</span>
                </a>

                <div class="w-[28%] table-header-section">
                    <span class="text-smaller my-auto ml-1.5">{thread.author}</span>
                </div>

                <div class="w-[19%] table-header-section">
                    <span class="text-smaller m-auto">{thread.postCount}</span>
                </div>

                <div class="w-[16%] table-header-section">
                    <span class="text-smaller m-auto">{thread.views}</span>
                </div>

                <div class="w-[25.5%] table-header-section">
                    <div class="m-auto flex flex-col text-center">
                        <span class="text-smaller"><b>{formatDate(thread.lastPost?.createdAt ?? thread.createdAt)}</b></span>
                        <span class="text-smaller">{thread.lastPost?.author ?? thread.author}</span>
                    </div>
                </div>
            </div>
        {/each}
    </div>

    <div class="w-full bg-[#2D528F] h-[33.2px]"></div>
</div>

<div class="flex flex-row mb-[20px] mt-0.5">
    <span class="text-small-bold">Page {page} of {totalPages}</span>

    {#if totalPages != 1}
        <div class="ml-auto select-none">
            <span class="text-small-bold">Goto to page:</span>

            {#if page != 1}
                <button
                    class="text-[#0055B3] font-bold"
                    onclick={() => switchPage(page - 1)}
                >
                    Prev
                </button>
            {/if}

            {#each pagination() as p}
                {#if p === "..."}
                    <span class="mx-0.5 text-small-bold">…</span>
                {:else}
                    <button
                        class="text-[#0055B3] font-bold mx-0.5"
                        class:text-black={p === page}
                        onclick={() => switchPage(p)}
                    >
                        {p}
                    </button>
                {/if}
            {/each}

            {#if page != totalPages}
                <button
                    class="text-[#0055B3] font-bold"
                    onclick={() => switchPage(page + 1)}
                >
                    Next
                </button>
            {/if}
        </div>
    {/if}
</div>

<Breadcrumbs forum={data.forum} />

<style>
    .table-header-section {
        display: flex;
        border-top: none;
    }
</style>