import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
    if (locals.admin) {
        return redirect(307, "/cs");
    }
    if (locals.user?.totpEnrolled === false) {
        return redirect(308, "/cs/totp/enroll");
    }
    return {};
}
