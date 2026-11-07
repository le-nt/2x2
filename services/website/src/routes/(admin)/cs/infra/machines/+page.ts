import { api } from "@client/api";

export const load = async ({ fetch, url }) => {
    const success = url.searchParams.get("success");
    const error = url.searchParams.get("error");

    let flashData: { error: string | null; success: string | null } = { error: null, success: null };

    if (success !== null) {
        flashData.success = "Machine enrolled";
    } else if (error !== null) {
        flashData.error = error || "Unknown error";
    }

    const res = await api.admin.arbiter.listNodes.get(fetch);
    if (res.error) {
        return { flashData: { error: res.error.value.message || "Unknown error", success: null } };
    }
    
    const json = res.data;
    return {
        flashData,
        arbiters: json.arbiters || []
    };
};
