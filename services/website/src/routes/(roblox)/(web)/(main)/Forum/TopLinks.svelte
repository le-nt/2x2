<script>
    import Breadcrumbs from "./Breadcrumbs.svelte";
    let { forum = undefined } = $props();
</script>

<div class="flex flex-row">
    {#if forum}
        <Breadcrumbs {forum} />
    {/if}

    <div class="ml-auto">
        <a class="hover:underline font-semibold !text-[#343434] px-[5px]" href="/Forum/Default.aspx">Home</a>
        <a class="hover:underline font-semibold !text-[#343434] px-[5px] border-0 !border-l border-black border-solid" href="/Forum/Search/default.aspx">Search</a>
    </div>
</div>