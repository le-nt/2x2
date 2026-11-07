import { error, redirect } from '@sveltejs/kit';

export async function load({ locals, url }) {
    if (locals.admin && locals.user?.totpEnrolled === true) {
        // Do nothing, allow access
        return {};
    }
    function getReturnUrl() {
        const returnUrl = url.searchParams.get('returnUrl');
        if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
            return returnUrl;
        }
        return null;
    }

    const path = (locals.user?.totpEnrolled === false && !locals.admin)
        ? "/cs/totp/enroll"
        : "/cs/totp/challenge";

    const rUrl = getReturnUrl();
    const finalUrl = rUrl ? `${path}?returnUrl=${encodeURIComponent(rUrl)}` : path;

    return redirect(308, finalUrl);
}