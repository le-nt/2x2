import prisma from '@/prisma';
import assets from '@/util/assets';
import { AssetType, CreatorType } from '@/types/types';

export async function load({ locals }) {
    return {
        templates: await assets.getGameTemplates(),
        placeCount: await prisma.asset.count({
            where: {
                creatorId: locals.user?.id,
                creatorType: CreatorType.User,
                type: AssetType.Place
            }
        })
    };
}