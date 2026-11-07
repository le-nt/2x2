import { redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
    default: async ({ cookies, url }) => {
        cookies.set("interstitialPassed", "true", {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            secure: true,
            maxAge: 60 * 60 * 24 * 365
        });
        const returnUrl = url.searchParams.get('returnUrl');
        if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
            throw redirect(302, returnUrl);
        } else {
            throw redirect(302, '/');
        }
    }
};