import prisma from '@/prisma';
import type { Actions } from './$types';


export const actions: Actions = {
    default: async ({ cookies, locals }) => {
        const sessionCookie = cookies.get('.simulping');
        const sessionId = locals.admin?.id;
        if (sessionCookie && sessionId) {
            await prisma.adminSession.delete({
                where: {
                    id: sessionId
                }
            })
            cookies.delete('.simulping', { path: '/' });
        }
    }
};