<script>
	import Button from "@components/Button.svelte";
	import UserAd from "@components/UserAd.svelte";
	import Thumbnail from "@components/Thumbnail.svelte";
	import Feed from "./Feed.svelte";
	import { ThumbnailType } from "@/types/thumb";
	import { setTitle } from "@client/stores";

	let { data } = $props();
	setTitle("Home - ROBLOX");
</script>

<div class="flex">
	<UserAd type="skyscraper" class="!hidden xl:!flex mr-[24px]" />

	<div class="max-w-[970px] w-full">
		<div class="flex flex-row w-full">
			<a
				class="hidden sm:block mr-[24px] ml-[32px] h-[180px] w-[180px]"
				href="/users/{data.user?.id}/profile"
			>
				<Thumbnail
					id={data.user?.id}
					type={ThumbnailType.AvatarHeadShot}
					width={180}
					height={180}
				/>
			</a>
			<div class="w-[calc(100% - 216px)]">
				<h1 class="mt-[20px] sm:mt-[80px] mb-[12px]">
					<a
						href="/users/{data.user?.id}/profile"
						class="text-[40px] ml-4 sm:ml-0 !text-black font-normal"
						>Hello, {data.user?.username}!</a
					>
				</h1>
                <!-- <div class="restriction-banner">
					<span class="rbx-icon-flag-active align-middle inline"></span>
					<span class="align-middle text-red-600 inline">Your account is restricted. <a href="#top">Learn More</a></span>
				</div> -->
			</div>
		</div>

		<div class="flex flex-col-reverse sm:flex-row mt-0.5">
			<div class="mr-0 sm:mr-[10px] mt-3 sm:mt-0 w-full">
				<h3 class="ml-4 sm:ml-0">My Feed</h3>
				<div class="section-content mt-1">
					<div class="flex">
						<div class="form-group w-full">
							<input
								class="form-control input-field"
								placeholder="What are you up to?"
							/>
						</div>
						<Button
							class="w-[120px] ml-9.5"
							type="primary"
							size="md"
							text="Share"
						/>
					</div>

					<ul class="mt-2 p-0">
						<Feed isInitial={true} />
					</ul>
				</div>
			</div>

			<div class="ml-0 sm:ml-[10px] w-full">
				<div class="flex justify-between items-start">
					<h3 class="ml-4 sm:ml-0">Blog News</h3>
					<Button href="/blog" type="control" size="xs" text="See More" />
				</div>
				<div class="section-content mt-1">
					<span class="text-[18px]">Nothing yet...</span>
				</div>
			</div>
		</div>
	</div>

	<UserAd type="skyscraper" class="!hidden lg:!flex ml-[24px]" />
</div>

<style>
	.rbx-icon-default-negative,
	.rbx-icon-report.active,
	.rbx-icon-remove,
	.rbx-icon-flag,
	.rbx-icon-flag-active,
	.rbx-icon-warning,
	.rbx-icon-lock,
	.vlist .list-item .list-body:hover .rbx-icon-report {
		background-image: url(/images/NextStyleGuide/WIP_negative_or_mod.svg);
		background-repeat: no-repeat;
		background-size: 200% auto;
		width: 20px;
		height: 20px;
		display: inline-block;
	}
	.rbx-icon-flag {
		background-position: 0 -40px;
	}
	.rbx-icon-flag:hover {
		background-position: -20px -40px;
	}
	button:hover .rbx-icon-flag,
	a:hover .rbx-icon-flag {
		background-position: -20px -40px;
	}
	.rbx-icon-flag-active {
		background-position: -20px -40px;
	}
</style>
