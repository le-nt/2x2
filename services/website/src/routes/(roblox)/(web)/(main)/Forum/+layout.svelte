<script module lang="ts">
    function timeAgo(date: Date) {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSeconds = Math.floor(diffMs / 1000);

        if (diffSeconds < 60) {
            return "just now";
        }
        if (diffSeconds < 3600) {
            const minutes = Math.floor(diffSeconds / 60);
            return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
        }
        if (diffSeconds < 86400) {
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }

        const diffDays = Math.floor(diffSeconds / 86400);
        if (diffDays < 7) {
            return diffDays === 1 ? "a day ago" : `${diffDays} days ago`;
        }
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return weeks === 1 ? "a week ago" : `${weeks} weeks ago`;
        }
        if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return months === 1 ? "a month ago" : `${months} months ago`;
        }

        const years = Math.floor(diffDays / 365);
        return years === 1 ? "a year ago" : `${years} years ago`;
    }

    export function getCategoryName(category: ForumCategory): string {
        switch (category) {
            case ForumCategory.Roblox: return "ROBLOX";
            case ForumCategory.ClubHouses: return "Club Houses";
            case ForumCategory.GameCreationAndDevelopment: return "Game Creation and Development";
            case ForumCategory.Entertainment: return "Entertainment";
        }
    }

    export function generatePagination(current: number, total: number): (number | "...")[] {
        const pages: (number | "...")[] = [];
        if (total <= 10) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }

        pages.push(1);
        if (current > 4) {
            pages.push("...");
        }

        const start = Math.max(2, current - 1);
        const end = Math.min(total - 1, current + 1);
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        if (current < total - 3) {
            pages.push("...");
        }

        pages.push(total);
        return pages;
    }

    export function formatDate(dateString: string) {
        const date = new Date(dateString);
        const now = new Date();
        const isToday = now.toDateString() === date.toDateString();

        if (isToday) {
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } else {
            return timeAgo(date);
        }
    }
</script>

<script lang="ts">
    import UserAd from "@components/UserAd.svelte";
    import { ForumCategorySafe as ForumCategory } from "@shared/prisma-browser";
    import "@components/css/page/forum.css";

    let { children } = $props();
</script>

<div class="flex flex-col w-full justify-center max-w-[945px] xl:ml-20">
    <div class="w-full justify-center flex mb-10">
        <UserAd type="banner" class="!hidden sm:!flex mr-[165px]" />
    </div>
    <div class="flex flex-row">
        <div class="flex flex-col w-full">
            {@render children?.()}
        </div>
        <UserAd type="skyscraper" class="!hidden sm:!flex ml-[8.5px] mt-[68px]" />
    </div>
</div>