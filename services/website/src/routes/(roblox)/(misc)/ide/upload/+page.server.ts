import prisma from '@/prisma';
import { AssetType, CreatorType } from '@/types/types.js';
import { error } from '@sveltejs/kit';

export async function load({ url, locals }) {
    const assetId = Number(url.searchParams.get("assetId"));
    if (!assetId)
        error(400);

    const asset = await prisma.asset.findFirst({
        where: {
            id: assetId,
            type: AssetType.Place,
            creatorId: locals.user?.id,
            creatorType: CreatorType.User
        },
        select: {
            id: true,
            name: true
        }
    })
    if (!asset)
        error(404);
    
    return { asset };
}