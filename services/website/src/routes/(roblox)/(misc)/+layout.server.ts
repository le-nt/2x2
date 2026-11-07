import { redirect } from "@sveltejs/kit";

const authUrls = [ // * Urls that require you to be logged in
    "/ide/newplace",
    "/ide/publish",
    "/ide/upload"
];

export async function load({ locals, url }) {
    if (!locals.user && authUrls.includes(url.pathname))
        return redirect(308, "/newlogin")
}