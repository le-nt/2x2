import { nav } from "@shared/admin_nav";
import { hasHigherTrait } from "@client/traits";
import { UserAdminTraitSafe as UserAdminTrait } from "@shared/prisma-browser";
import { error, redirect } from '@sveltejs/kit';
import featUtil from "@/util/features";
import config from "@/util/config";

const excludedUrls = [
    "/cs", // * excluded because it's the redirect page
    "/cs/logout",
    "/cs/totp/challenge",
    "/cs/totp/enroll",
];

export async function load({ locals, url }) {
    if (locals.user === null || locals.user.roleSet === UserAdminTrait.Unprivileged || locals.user.roleSet === UserAdminTrait.ProtectedUser) {
        return redirect(308, "/videos/dumbass.mp4");
    }

    const path = url.pathname;
    if (!locals.admin && !excludedUrls.includes(path)) { // * redirect to loopback (/cs) if u go onto an admin page with no auth
        return redirect(308, "/cs?returnUrl=" + encodeURIComponent(path + url.search));
    }

    const canView = nav.some(item => {
        return path === item.href && hasHigherTrait(locals.user!.roleSet, item.minimumRole);
    });

    if (!canView && !excludedUrls.includes(path)) {
        return error(403);
    }

    return {
        user: locals.user,
        admin: locals.admin,
        features: await featUtil.admin.getAllWithMetadata(),
        isTestWebsite: config.webserver.isTestWebsite,
        baseUrl: config.webserver.baseUrl,
    };
}