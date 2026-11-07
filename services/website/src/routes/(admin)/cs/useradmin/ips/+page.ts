import { api } from "@client/api";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch, url }) => {
    const id = url.searchParams.get("id");
    if (!id) {
        return {
            ips: null
        };
    }
    const req = await api.admin.users.getUserIps.get(fetch, {
        params: {
            id: id
        }
    });

    if (!req.error) {
        return {
            ips: req.data.ips
        };
    } else {
        return {
            ips: null
        }
    }
};
