import { error } from "@sveltejs/kit";
import { api } from "@client/api";

export const load = async ({ fetch, url }) => {
    const postId = await url.searchParams.get("PostID");
    if (postId === null) error(400);
    
    const res = await api.admin.forum.getPost.get(fetch, { query: { postId } });
    if (res.error || !res.data) {
        error(400);
    }

    return { post: res.data.data };
};
