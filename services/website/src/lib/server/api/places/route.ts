import prisma from "@/prisma";
import auth from "@/macros/auth";
import { AssetType, CreatorType } from "@/types/types";
import { Elysia, status, t } from "elysia";
import assets from "@/util/assets";

const places = new Elysia({ prefix: "/places" })
    .use(auth.as("scoped"));

places.get(
    "/:id/settings",
    async ({ params, user }) => {
        const place = await prisma.asset.findFirst({
            where: {
                id: params.id,
                type: AssetType.Place,
                creatorId: user.id
            },
            include: { creatorUser: true }
        })
        if (!place)
            return status(400);

        return { 
            Creator: { 
                Id: place.creatorId,
                Name: place.creatorUser?.username,
                CreatorType: place.creatorType == CreatorType.User ? "User" : "Group",
            }
        };
    },
    {
        params: t.Object({
            id: t.Number()
        }),
        auth: true
    }
);

places.post(
    "/:id/updatesettings",
    async ({ params, user, body }) => {
        const place = await prisma.place.findFirst({
            where: { id: params.id },
            include: { universe: true }
        });
        if (!place?.universe || !assets.canEditUniverse(place.universe, user.id))
            return status(400);
        
        await prisma.asset.update({
            where: { id: params.id },
            data: { name: body.Name, description: body.Description }
        })
    },
    {
        params: t.Object({
            id: t.Number()
        }),
        body: t.Object({
            Name: t.String({ minLength: 1, maxLength: 30 }),
            Description: t.String({ minLength: 1, maxLength: 100 }),
        }),
        auth: true
    }
);

places.get("/get-all", async ({ query, user, set }) => {
    // * 0=Me, 1=MyGames, 2=OtherGames
    const { sortBy, includeInactivePlaces } = query;

    // * If includeInactivePlaces is true, do not filter by isPrivate.
    // * If false, only include active (isPrivate: false) universes.
    const universeIsPrivateFilter =
        includeInactivePlaces === true
            ? {}
            : { isPrivate: false };

    if (sortBy === 0) {
        const places = await prisma.place.findMany({
            where: {
                asset: {
                    creatorType: CreatorType.User,
                    creatorId: user.id
                },
                universe: universeIsPrivateFilter
            },
            select: {
                id: true,
                visits: true,
                asset: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        updatedAt: true
                    }
                },
                universe: {
                    select: {
                        isPrivate: true
                    }
                }
            },
            orderBy: {
                asset: { updatedAt: "desc" }
            }
        })
        set.status = 200;
        return {
            success: true,
            data: places
        }
    } else if (sortBy === 1) {
        const places = await prisma.place.findMany({
            where: {
                asset: {
                    creatorType: CreatorType.User,
                    creatorId: user.id
                },
                universe: universeIsPrivateFilter
            },
            select: {
                id: true,
                visits: true,
                asset: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        updatedAt: true
                    }
                },
                universe: {
                    select: {
                        startPlaceId: true,
                        isPrivate: true
                    }
                }
            },
            orderBy: {
                asset: { updatedAt: "desc" }
            }
        })
        let filteredPlaces = [];
        for (const place of places) {
            if (place.universe?.startPlaceId === place.id) {
                filteredPlaces.push(place);
            }
        }
        set.status = 200;
        return {
            success: true,
            data: filteredPlaces
        };
    } else if (sortBy === 2) {
        const placesWhereUserIsEditor = await prisma.place.findMany({
            where: {
                asset: {
                    creatorType: {
                        in: [CreatorType.User]
                    }
                },
                universe: {
                    editors: {
                        hasSome: [user.id]
                    },
                    isCloudEdit: true,
                    ...universeIsPrivateFilter
                }
            },
            select: {
                id: true,
                asset: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        updatedAt: true
                    }
                },
                universe: {
                    select: {
                        isPrivate: true
                    }
                }
            },
            orderBy: {
                asset: { updatedAt: "desc" }
            }
        })
        // TODO: Groups
        return {
            success: true,
            data: placesWhereUserIsEditor
        };
    } else {
        set.status = 400;
        return;
    }
}, {
    query: t.Object({
        sortBy: t.Number(),
        includeInactivePlaces: t.Boolean()
    }),
    auth: true
});

places.post(
    "/create",
    async ({ query, body, user }) => {
        const universe = await prisma.universe.findFirst({
            where: { id: query.universeId }
        });
        if (!universe || !assets.canEditUniverse(universe, user.id))
            return status(400);
        await assets.createPlace(body.Name, body.Description, universe);
    },
    {
        body: t.Object({
            Name: t.String({ minLength: 1, maxLength: 30 }),
            Description: t.String({ minLength: 1, maxLength: 100 }),
        }),
        query: t.Object({
            universeId: t.Number()
        }),
        auth: true
    }
)

places.get(
    "/defaultsettings",
    () => ({
        Name: "Baseplate",
        Description: "Baseplate",
        StudioAccessToApisAllowed: true,
        CurrentUserHasEditPermissions: true,
        UniverseAvatarType: "PlayerChoice",
    })
)

export default places;