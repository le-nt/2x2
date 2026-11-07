import { api } from "@client/api";
import { error } from "@sveltejs/kit";

export const load = async ({ fetch, url }) => {
    const forumId = url.searchParams.get("ForumID");
    const page = url.searchParams.get("Page") || 1;
    if (!forumId) error(404);

    const forum = await api.forums.threads.get(fetch, {
        params: { id: forumId },
        query: { page }
    });
    if (forum.error || (forum.data.threads.length == 0 && page != 1))
        error(404);

    return forum.data;
};
