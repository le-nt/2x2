<script lang="ts">
	import TopLinks from "../TopLinks.svelte";
	import { page as pageState } from "$app/state";
	import { generatePagination } from "../+layout.svelte";
	import { goto } from "$app/navigation";
	import Breadcrumbs from "../Breadcrumbs.svelte";
	import Button from "@components/legacy/Button.svelte";
	import { onMount } from "svelte";
	import { api } from "@client/api";
	import { UserAdminTraitSafe as UserAdminTrait } from "@shared/prisma-browser";
	import { hasHigherTrait } from "@client/traits";
	import { ThumbnailType } from "@/types/thumb";
	import Thumbnail from "@components/Thumbnail.svelte";

	let { data } = $props();

	let { page, totalPages: rawTotalPages } = $derived(data.pagination);
	let totalPages = $derived(() => (rawTotalPages === 0 ? 1 : rawTotalPages));
	let pagination = $derived(() => generatePagination(page, totalPages()));

	function formatDate(dateString: string, withTime = false) {
		const date = new Date(dateString);

		const datePart = date.toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});

		if (!withTime) return datePart;

		const timePart = date
			.toLocaleTimeString("en-GB", {
				hour: "2-digit",
				minute: "2-digit",
				hour12: true,
			})
			.toUpperCase();

		return `${datePart} ${timePart}`;
	}

	function switchPage(page: number) {
		const params = new URLSearchParams(pageState.url.searchParams);
		params.set("Page", String(page));
		goto(`?${params}`);
	}

	function onSortChange(event: any) {
		const sortOrder = event.target.value;
		page = 1;

		const params = new URLSearchParams(pageState.url.searchParams);
		params.set("SortOrder", String(sortOrder));
		params.set("Page", String(page));

		goto(`?${params}`);
	}

	onMount(async () => {
		await api.forums.markAsRead.post(fetch, {
			params: { id: data.thread.id },
		});
	});
</script>

<TopLinks forum={data.forum} />

<h2 class="my-[20px]">{data.thread.title}</h2>

<div class="flex items-start">
	<span class="text-small-bold mt-[2px] mr-[2px] ml-auto">Sort: </span>
	<select class="select-input text-small" onchange={onSortChange}>
		<option value="asc">Oldest to newest</option>
		<option value="desc">Newest to oldest</option>
	</select>
</div>

<div class="flex flex-col w-full mt-1.5">
	<div class="flex flex-row items-center w-full bg-[#2D528F] h-[38px]">
		<button class="!mr-0 ml-auto table-title"> Previous Thread </button>

		<span class="font-bold !text-[20px] pl-1 pr-1">::</span>

		<button class="!mr-2.5 !ml-0 table-title"> Next Thread </button>
	</div>

	<div class="flex flex-col">
		{#each data.posts as post, i}
			<div class="flex flex-row w-full bg-[#f9f9f9]">
				<div class="w-[186px] flex flex-col">
					<a class="font-bold" href="/users/{post.author.id}/profile"
						>{post.author.username}</a
					>
					<div class="w-[108px] h-[107px] mt-0.5">
						<Thumbnail
							id={data.user?.id}
							type={ThumbnailType.Avatar}
							width={100}
							height={100}
						/>
					</div>

					{#if (post.author.adminStatus?.trait ?? post.author.roleSet) !== UserAdminTrait.Unprivileged && (post.author.adminStatus?.trait ?? post.author.roleSet) !== UserAdminTrait.ProtectedUser}
						<div class="w-[108px] h-[22px] mb-[5px]">
							<img
								src="/images/Forums/users_moderator.gif"
								alt="Forum Moderator"
							/>
						</div>
					{/if}

					<span class="text-[13px] font-medium !mt-[-4px]">
						<b>Joined:</b>
						<span class="text-[12.5px]"
							>{formatDate(post.author.createdAt)}</span
						>
					</span>
					<span class="text-[13px] font-medium mt-1">
						<b>Total Posts:</b>
						<span class="text-[12.5px]"
							>{post.author._count.forumPosts +
								post.author._count.forumThreads}</span
						>
					</span>
				</div>

				<div class="w-full !mt-1">
					<span class="text-smaller">{formatDate(post.createdAt, true)}</span>
					<div class="min-h-[131px] text-small mt-1 mb-[22px]">
						<span class="whitespace-pre-line">{post.content}</span>
					</div>
					<div class="mb-2 min-h-[18px]">
						{#if hasHigherTrait(data.user.roleSet ?? data.user.adminStatus, UserAdminTrait.ForumModerator)}
							<a
								class="text-[13px] font-light"
								rel="external"
								href={post.postId
									? `/cs/forum/moderate-post?PostID=${post.postId}`
									: `/cs/forum/moderate-thread?ThreadID=${data.thread.id}`}
							>
								<b class="color-red-500">
									Manage {post.postId ? "Post" : "Thread"}
								</b>
							</a>
							{#if post.hidden}
								<div class="bg-red-800 text-white font-bold p-2 rounded mt-2">
									<span>
										This {post.postId ? "Post" : "Thread"} is hidden from users!
									</span>
								</div>
							{/if}
						{/if}
					</div>
				</div>
			</div>
			{#if i !== data.posts.length - 1 && data.posts.length !== 1}
				<div class="bg-[#d8d8d8] h-[1px]"></div>
			{/if}
		{/each}
	</div>

	<div class="flex flex-row items-center w-full bg-[#2D528F] h-[38px]">
		<button class="!mr-0 ml-auto table-title"> Previous Thread </button>

		<span class="font-bold !text-[20px] pl-1 pr-1">::</span>

		<button class="!mr-2.5 !ml-0 table-title"> Next Thread </button>
	</div>
</div>

<div class="flex flex-row mb-[20px] mt-0.5">
	<span class="text-small-bold">Page {page} of {totalPages()}</span>

	{#if totalPages() != 1}
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

<div class="flex justify-center w-full mb-[20px]">
	<Button
		href="/Forum/AddPost.aspx?PostID={data.thread.id}&mode=flat"
		type="control"
		size="medium"
		text="Add a Reply"
	/>
</div>

<Breadcrumbs forum={data.forum} />
