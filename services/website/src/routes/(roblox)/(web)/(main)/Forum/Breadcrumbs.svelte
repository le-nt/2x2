<script>
    import { getCategoryName } from "./+layout.svelte";
    let { forum } = $props();
</script>

<div>
    <a class="font-bold tracking-[-0.1px] !text-[#095fb5]" href="/Forum/Default.aspx">ROBLOX Forum</a>
    <span class="text-small-bold"> » </span>
    <a class="font-bold tracking-[-0.1px] !text-[#095fb5]" href="#top">{getCategoryName(forum.category)}</a>
    <span class="text-small-bold"> » </span>
    <a class="font-bold tracking-[-0.1px] !text-[#095fb5]" href="/Forum/ShowForum.aspx?ForumID={forum.id}">{forum.name}</a>
</div>