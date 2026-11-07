import { api } from "@client/api";
import { error } from "@sveltejs/kit";

export const load = async ({ params, fetch }) => {
    const user = await api.profile.get(fetch, {
        params: { id:  Number(params.userId) }
    });
    if (user.error)
        error(404);
    return { profile: user.data };
}