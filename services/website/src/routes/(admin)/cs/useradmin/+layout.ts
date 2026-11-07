import { api } from "@client/api";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ url, fetch }) => {
	const id = url.searchParams.get("id");
	if (!id) {
		throw error(400, "User ID is required");
	}

	const res = await api.admin.users.getUser.get(fetch, {
        params: {
            id
        }
    })

	if (res.error) {
		throw error(400, "Failed to fetch user, try refreshing");
	}

	return {
		user: res.data.data,
	};
};
