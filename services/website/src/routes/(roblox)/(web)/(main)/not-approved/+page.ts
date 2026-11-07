import { api } from "@client/api";
import { redirect, error } from "@sveltejs/kit";
export const load = async ({ fetch }) => {
    const response = await api.whyAmIBanned.get(fetch);
    if (response.error) {
        throw error(500);
    }
    if (response.data?.data === null) {
        return redirect(308, "/home");
    }
    return {
        banData: response.data.data
    }
}