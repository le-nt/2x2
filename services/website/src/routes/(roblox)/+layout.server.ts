import featUtil from "@/util/features";
import config from "@/util/config";
import { redirect } from "@sveltejs/kit";
import { AccountStatus } from "@/types/roblox";

const homeUrls = [ // * Urls that redirect to home when logged in
    "/",
    "/newlogin"
];

const allowed_bots = [
    "Discord", // * Discord embeds
    "Discordbot", // * Discord embeds
    "discordapp.com", // * Discord embeds
    "Googlebot", // * Google
    "Bingbot", // * Bing
    "Slurp", // * Yahoo (dinosaur)
    "DuckDuckBot", // * DuckDuckGo
    "archive.org_bot", // * Wayback Machine (we love archival)
]

export async function load({ locals, url, cookies, request }) {
    if (locals.user && homeUrls.includes(url.pathname)) {
        return redirect(308, "/home")
    }

    function getReturnUrl() {
        if (url.pathname !== "/") {
            const returnUrl = url.pathname + url.search;
            if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
                return returnUrl;
            }
            return null;
        } else if (url.pathname === "/" && url.search) {
            const returnUrl = url.pathname + url.search;
            if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
                return returnUrl;
            }
            return null;
        } else if (url.pathname === "/" && !url.search) {
            return null;
        } else {
            return null;
        }
    }

    const path = "/InterstitialPage.aspx";
    const rUrl = getReturnUrl();
    const finalUrl = rUrl ? `${path}?returnUrl=${encodeURIComponent(rUrl)}` : path;

	const interstitialPassed = cookies.get("interstitialPassed")
	const userAgent = request.headers.get("user-agent") || "";
	const isAllowedBot = allowed_bots.some(bot => userAgent.includes(bot));
    console.log("User-Agent:", userAgent, "isAllowedBot:", isAllowedBot);
	if (!interstitialPassed && url.pathname !== "/InterstitialPage.aspx" && !isAllowedBot) {
		return redirect(302, finalUrl);
	}

    let user = locals.user;
    if (user && user.accountStatus !== AccountStatus.Ok) {
        user = { ...user, robux: "?", tickets: "?" };
    }

    return {
        captchaKey: config.turnstile.siteKey,
        user,
        admin: locals.admin,
        features: await featUtil.admin.getAll(),
        baseUrl: config.webserver.baseUrl,
        isTestWebsite: config.webserver.isTestWebsite,
    };
}