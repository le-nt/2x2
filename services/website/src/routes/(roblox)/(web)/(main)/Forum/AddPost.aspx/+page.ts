import { api } from "@client/api";
import { error } from "@sveltejs/kit";

export const load = async ({ fetch, url }) => {
    const forumIdParam = url.searchParams.get("ForumID");
    const postIdParam = url.searchParams.get("PostID");

    const forumId = forumIdParam ? Number(forumIdParam) : null;
    const postId = postIdParam ? Number(postIdParam) : null;

    if (forumId && !isNaN(forumId)) {
        const forum = await api.forums.threads.get(fetch, {
            params: { id: forumId }
        });
        if (forum.error) error(404);
        return { ...forum.data, isReply: false };
    }

    if (postId && !isNaN(postId)) {
        const post = await api.forums.thread.get(fetch, {
            params: { id: postId }
        });
        if (post.error) error(404);
        return { ...post.data, isReply: true };
    }

    error(404);
};
