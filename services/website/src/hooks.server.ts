import { type Handle } from "@sveltejs/kit";
import users from "@/util/users";
import ip from "@/util/ip";

export const handle: Handle = async ({ event, resolve }) => {
    // * swagger client doesnt fetch the right path
    if (event.url.pathname === "/openapi/json") {
        return Response.redirect("/api/openapi/json", 301);
    }
	const ipAddress = event.request.headers.get("x-forwarded-for") || "127.0.0.1";
	/*
	! Just know...
	* Bun has issues with getting the client address - so we recommend passing x-forwarded-for,
	* e.g via Caddy. Idk how this ties into Anubis thooooo..... maybe I'm dumb. We'll see.
	*/
	const hashedIp = ip.encryption.hashIP(ipAddress);
	const banned = ip.bannedIpCache.has(hashedIp);
	if (banned) {
		return new Response(null, { status: 403 });
	}

    // * authentication
    const token = event.cookies.get(".ROBLOSECURITY") ?? null
	const admintoken = event.cookies.get(".simulping") ?? null;
	if (token !== null) {
		const session = await users.validateSession(token);
		const user = session?.User;
		if (user !== null) {
			event.locals.user = {
				id: user.id,
				username: user.username,
				robux: user.robux,
				tickets: user.tickets,
				roleSet: user.roleSet,
				totpEnrolled: user.totpEnrolled ?? false,
				accountStatus: user.accountStatus,
			};
		} else {
			event.locals.user = null;
		}
	} else {
		event.locals.user = null;
	}
	if (token !== null && admintoken !== null) {
		const adminSession = await users.validateAdminSession(admintoken, token);
		if (!adminSession.Session || !adminSession.User || adminSession.Session?.expiresAt > new Date()) {
			event.locals.admin = null;
		}
		event.locals.admin = adminSession.Session;
	} else {
		event.locals.admin = null;
	}

	const response = await resolve(event);
	if (event.url.pathname == "/games/start") { // fuck this shit
		response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
		response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
		response.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
	}
	return response;
};