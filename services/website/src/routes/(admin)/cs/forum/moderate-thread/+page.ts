import { error } from "@sveltejs/kit";
import { api } from "@client/api";

export const load = async ({ fetch, url }) => {
    const threadId = await url.searchParams.get("ThreadID");
    if (threadId === null) {
        error(400);
    }

    const res = await api.admin.forum.getThread.get(fetch, { query: { threadId } });
    if (res.error || !res.data) {
        error(400);
    }

    return { thread: res.data.data };
};
