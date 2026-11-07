import { api } from "@client/api";
import { error } from "@sveltejs/kit";

export const load = async ({ fetch }) => {
    const totp = await api.admin.totp.init.post(fetch);
    if (totp.error)
        error(500, "Failed to initialize TOTP");
    return totp.data;
}
