import { api } from "@client/api";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
	const req = await api.admin.flags.list.get(fetch);

	if (!req.error) {
		return {
			features: req.data.features
		};
	} else {
		return {
            features: []
		}
	}
};
