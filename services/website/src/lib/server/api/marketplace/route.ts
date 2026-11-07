import prisma from "@/prisma";
import { CreatorType } from "@/types/types";
import { Elysia, status, t } from "elysia";

const marketplace = new Elysia({ prefix: "/marketplace" });

marketplace.get(
    "/productinfo",
    async ({ query }) => {
        const assetId = query.assetId ?? query.assetid; // fuck you roblox
        if (!assetId)
            return status(400);

        const asset = await prisma.asset.findFirst({
            where: { id: assetId },
            include: { creatorUser: true }
        });
        if (!asset)
            return status(404);

        return {
            Name: asset.name,
            Description: asset.description,
            Created: asset.createdAt,
            Updated: asset.updatedAt,
            PriceInRobux: 0,
            PriceInTickets: 0,
            AssetId: asset.id,
            ProductId: asset.id,
            AssetTypeId: asset.type,
            Creator: {
                Id: asset.creatorId,
                Name: asset.creatorUser?.username,
                CreatorType: asset.creatorType == CreatorType.User ? "User" : "Group",
            },
            MinimumMembershipLevel: 0,
            IsForSale: false,
        };
    },
    {
        query: t.Object({
            assetId: t.Optional(t.Number()),
            assetid: t.Optional(t.Number())
        })
    }
);

export default marketplace;