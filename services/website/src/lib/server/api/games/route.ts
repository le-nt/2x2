import { Elysia, t } from "elysia";
import prisma from "@/prisma";
import { Prisma } from "@prisma/client";

const games = new Elysia({ prefix: "/games" });
games.get("/sort", async ({ query }) => {
    const { sortType, page = 1, pageSize = 10, assetGenre } = query;

    // * This is used for extra options in the query
    let whereClause = `
        WHERE a."isApproved" = true
        AND p."universeId" IS NOT NULL
    `;
    if (sortType === "Featured") {
        whereClause += ` AND p.featured = true`;
    }
    if (assetGenre) {
        whereClause += ` AND a."assetGenre" = ${assetGenre}`;
    }

    let orderByClause = "";
    switch (sortType) {
        case "Popular":
            orderByClause = `ORDER BY player_count DESC`;
            break;
        case "Featured":
            orderByClause = `ORDER BY p.visits DESC`;
            break;
        case "RecentlyUpdated":
            orderByClause = `ORDER BY p."updatedAt" DESC`;
            break;
        case "TopRated":
            orderByClause = `ORDER BY likes_count DESC, dislikes_count ASC`;
            break;
        // TODO: Implement RecentlyVisited with auth
        default:
            orderByClause = `ORDER BY p.id`;
    }

    // * Get count of places
    const countResult = await prisma.$queryRaw`
        SELECT COUNT(*)::int as count
        FROM "Place" p
        JOIN "Asset" a ON p.id = a.id
        ${Prisma.raw(whereClause)}
    ` as { count: number }[];
    const totalCount = countResult[0].count;

    // * Get places with queryRaw because FUCK YOU PRISMA
    const results = await prisma.$queryRaw`
        SELECT 
        p.id,
        a.name,
        a."creatorId",
        a."creatorType",
        COALESCE(u.username, 'Unknown') as creator_name,
        COALESCE(
            (
                SELECT COUNT(*)::int
                FROM "Gameserver" gs 
                JOIN "_GameserverToUser" gtu ON gs.id = gtu."A"
                WHERE gs."placeId" = p.id
            ), 0
        ) as player_count,
        (
            SELECT COUNT(*)::int
            FROM "PlaceLikes" l
            WHERE l."placeId" = p.id
        ) as likes_count,
        (
            SELECT COUNT(*)::int
            FROM "PlaceDislikes" d
            WHERE d."placeId" = p.id
        ) as dislikes_count
        FROM "Place" p
        JOIN "Asset" a ON p.id = a.id
        LEFT JOIN "User" u ON a."creatorId" = u.id
        ${Prisma.raw(whereClause)}
        ${Prisma.raw(orderByClause)}
        LIMIT ${pageSize}
        OFFSET ${(page - 1) * pageSize}
    ` as {
        id: bigint;
        name: string;
        creatorId: number;
        creatorType: string;
        creator_name: string;
        player_count: number;
        likes_count: number;
        dislikes_count: number;
    }[];

    const result = results.map(place => ({
        id: Number(place.id),
        name: place.name,
        players: Number(place.player_count),
        creatorId: place.creatorId,
        creatorName: place.creator_name,
        creatorType: place.creatorType,
        likes: Number(place.likes_count),
        dislikes: Number(place.dislikes_count),
    }));

    return {
        result,
        lastPage: Math.ceil(totalCount / pageSize)
    };
}, {
    query: t.Object({
        sortType: t.Union([
            t.Literal("Popular"),
            t.Literal("RecentlyUpdated"),
            t.Literal("RecentlyVisited"),
            t.Literal("TopRated"),
            t.Literal("Featured")
        ]),
        page: t.Optional(t.Number({ minimum: 1, default: 1 })),
        pageSize: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 10 })),
        assetGenre: t.Optional(t.Number({ default: 0 }))
    })
});

games.get("/get", async ({ query, set }) => {
    // * Try to get place
    const place = await prisma.place.findUnique({
        where: { id: query.placeId },
        include: {
            asset: {
                include: {
                    creatorUser: true,
                }
            },
            likes: true,
            dislikes: true
        },
    })
    if (!place) {
        set.status = 404;
        return;
    }

    // * Play histories
    const playingNow = await prisma.playHistory.count({
        where: {
            placeId: query.placeId,
            endTime: null
        }
    });

    return {
        id: Number(place.id),
        name: place.asset.name,
        description: place.asset.description,
        createdAt: new Intl.DateTimeFormat('en-US').format(place.asset.createdAt),
        updatedAt: new Intl.DateTimeFormat('en-US').format(place.asset.updatedAt),
        genre: place.asset.assetGenre,
        maxPlayers: place.maxPlayerCount,
        players: playingNow,
        creatorId: place.asset.creatorId,
        creatorName: place.asset.creatorUser?.username || "Unknown",
        creatorType: place.asset.creatorType,
        likes: place.likes.length,
        dislikes: place.dislikes.length,
        visits: place.visits
    };
}, {
    query: t.Object({
        placeId: t.Number()
    })
});

export default games;