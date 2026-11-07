import { api } from "@client/api";
import { error } from "@sveltejs/kit";

export const load = async ({ fetch }) => {
    const forums = await api.forums.categories.get(fetch);
    if (forums.error)
        error(404);
    return { forums: forums.data.forums };
}