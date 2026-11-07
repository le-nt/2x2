import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
    const interstitialPassed = cookies.get('interstitialPassed');
    if (interstitialPassed !== undefined) {
        throw redirect(302, '/');
    }
    return {};
};
