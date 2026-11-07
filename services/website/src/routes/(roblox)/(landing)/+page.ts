import type { PageLoad } from "./$types";
import { api } from "@client/api";

export const load: PageLoad = async ({ url, fetch }) => {
	const inviteAutofill = url.searchParams.get("i");
    if (inviteAutofill) {
        return {
            inviteAutofill: inviteAutofill,
        }
    }
};
