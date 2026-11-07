import { redirect } from '@sveltejs/kit';

export async function load({ url }) {
    const code = Number(url.searchParams.get("code"));
    if (!code)
        redirect(308, "/");
    return { code };
}