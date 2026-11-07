import { api } from "@client/api";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch }) => {
	const req = await api.admin.dashBoardData.get(fetch);

	if (!req.error) {
		return {
			dashData: req.data.data
		};
	} else {
		return {
            dashData: null
		}
	}
};
