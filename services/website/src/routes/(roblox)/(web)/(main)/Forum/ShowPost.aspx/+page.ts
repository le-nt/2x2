import { api } from "@client/api";
import { error } from "@sveltejs/kit";

export const load = async ({ fetch, url }) => {
    const postId = url.searchParams.get("PostID");
    const sortOrder = url.searchParams.get("SortOrder") || "asc";
    const page = Number(url.searchParams.get("Page")) || 1;
    if (!postId || page < 1) error(404);

    const thread = await api.forums.thread.get(fetch, {
        params: { id: postId },
        query: { page, sortOrder, perPage: Number(page) <= 1 ? 24 : 25 }
    });
    if (thread.error || thread.data.thread ==  null) {
        error(404);
    }

    const totalPages = thread.data.pagination.totalPages || 1;
    if (page === 1 && sortOrder === "asc") {
        thread.data.posts.unshift(thread.data.thread);
    } else if (page === totalPages && sortOrder === "desc") {
        thread.data.posts.push(thread.data.thread);
    }

    return thread.data;
};