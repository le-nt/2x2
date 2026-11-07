import { redirect } from '@sveltejs/kit';
import users from "@/util/users";

export async function load({ locals, url }) {
    if(!locals.user) {
        return redirect(308, "/newlogin")
    }
    const banned = await users.isBanned(locals.user.id);
    if (banned && url.pathname !== "/not-approved") {
        return redirect(308, "/not-approved");
    }
}