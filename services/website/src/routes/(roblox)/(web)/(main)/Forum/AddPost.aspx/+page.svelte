<script lang="ts">
    import Breadcrumbs from "../Breadcrumbs.svelte";
    import TopLinks from "../TopLinks.svelte";
    import Button from "@components/legacy/Button.svelte";
    import { api } from "@client/api";
    import { goto } from "$app/navigation";

    let { data } = $props();
    let error = $state("");
    let title = $state("");
    let content = $state("");

    async function submit() {
        error = "";
        if (title.length < 3 && !data.isReply) {
            error = "Subject must be atleast 3 characters long";
            return;
        }
        if (title.length > 100 && !data.isReply) {
            error = "Subject must be at most 100 characters long";
            return;
        }

        if (content.length < 10) {
            error = "Message must be atleast 10 characters long";
            return; 
        }
        if (content.length > 10000) {
            error = "Message must be at most 10000 characters long";
            return; 
        }

        if (data.isReply) {
            const post = await api.forums.newPost.post(fetch, {
                params: { id: data.thread.id },
                body: { content }
            })
            if (post.error) {
                error = post.error.value.message || post.error.value.error || "Unknown error";
                return;
            }
            goto(`/Forum/ShowPost.aspx?PostID=${data.thread.id}`)
        } else {
            const thread = await api.forums.newThread.post(fetch, {
                params: { id: data.forum.id },
                body: { title, content }
            })
            if (thread.error) {
                error = thread.error.value.message || thread.error.value.error;
                return;
            }
            goto(`/Forum/ShowPost.aspx?PostID=${thread.data.threadId}`)
        }
    }

    function formatDate(dateString: string) {
        const date = new Date(dateString);

        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();

        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');

        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        if (hours === 0) hours = 12;
        const hourStr = String(hours).padStart(2, '0');

        return `${month}-${day}-${year} ${hourStr}:${minutes} ${ampm}`;
    }
</script>

<TopLinks forum={data.forum} />

<h2 class="mt-5 mb-5">
    {#if data.isReply}
        Reply to Post
    {:else}
        New Post
    {/if}
</h2>

{#if data.isReply}
    <div class="flex w-full bg-[#2D528F] h-[35px]">
        <span class="table-title w-full text-center">Original Post</span>
    </div>

    <div class="flex flex-col bg-white items-start">
        <a class="font-bold mt-0.5" href="/Forum/ShowPost.aspx?PostID={data.thread.id}">{data.thread.title}</a>
        <span class="text-small mt-0.5">Posted by <a class="" href="/users/{data.thread.author.id}/profile">{data.thread.author.username}</a> on {formatDate(data.thread.createdAt)}</span>
        <div class="text-small mt-5 mb-6">
            <span class="whitespace-pre-line">{data.thread.content}</span>
        </div>
    </div>

    <div class="flex w-full bg-[#2D528F] h-[35px] mb-2">
        <span class="table-title w-full text-center">New Post</span>
    </div>
{/if}

<div class="flex flex-col ml-4">
    <div class="flex flex-row ml-[5px]">
        <span class="font-bold">Subject: </span>
        {#if data.isReply}
            <span class="text-small ml-1">Re: {data.thread.title}</span>
        {:else}
            <input type="text" name="subject" class="text-box text-box-large ml-1 w-[660px]" bind:value={title}>
        {/if}
    </div>

    <div class="flex flex-row mt-2">
        <span class="font-bold">Message: </span>
        <textarea class="text-box text-box-large w-[660px] ml-1 resize-none" cols="80" name="body" rows="15" bind:value={content}></textarea>
    </div>

    <div class="flex flex-row w-[668px] ml-15 mt-2 mb-4">
        <div class="flex flex-row items-center">
            <input type="checkbox">
            <span class="text-[15px] font-medium ml-0.5">Do not allow replies to this post</span>
        </div>

        <div class="flex flex-row ml-auto">
            <Button
                class="!px-2.5 mr-2 !text-[14px]"
                type="control"
                href={data.isReply
                    ? `/Forum/ShowPost.aspx?PostID=${data.thread.id}`
                    : `/Forum/ShowForum.aspx?ForumID=${data.forum.id}`}
                size="medium"
                text="Cancel"
            />
            <Button class="!px-2.5 !text-[14px]" type="control" size="medium" text="Post" onclick={submit} />
        </div>
    </div>
</div>

{#if error}
    <span class="text-error !text-[14px] !mb-2">{error}</span>
{/if}

<Breadcrumbs forum={data.forum} />