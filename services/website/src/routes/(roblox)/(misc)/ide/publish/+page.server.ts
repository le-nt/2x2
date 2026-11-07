import prisma from '@/prisma';
import { AssetType, CreatorType } from '@/types/types';

export async function load({ locals }) {
    const assets = await prisma.asset.findMany({
        where: {
            type: AssetType.Place,
            creatorId: locals.user?.id,
            creatorType: CreatorType.User
        },
        select: {
            id: true,
            name: true
        }
    })
    return { assets };
}