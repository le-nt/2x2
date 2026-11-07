import auth from "@/macros/auth";
import prisma from "@/prisma";
import { CreatorType } from "@/types/types";
import assets from "@/util/assets";
import { Elysia, status, t } from "elysia";

const universes = new Elysia({ prefix: "/universes" })
    .use(auth.as("scoped"));

universes.get("/validate-place-join", ({ set }) => {
    set.headers["content-type"] = "application/json";
    return true;
});

universes.get(
    "/get-universe-containing-place",
    async ({ query }) => {
        const placeId = query.placeId ?? query.placeid; // fuck you roblox
        if (!placeId)
            return status(400);

        const place = await prisma.place.findFirst({
            where: {
                id: placeId
            },
            include: {
                universe: true
            }
        });

        return { UniverseId: place?.universe?.id ?? placeId };
    },
    {
        query: t.Object({
            placeId: t.Optional(t.Number()),
            placeid: t.Optional(t.Number())
        }),
        auth: true
    }
);

universes.get(
    "/get-info",
    async ({ query, user }) => {
        const startPlace = await assets.getStartPlace(query.universeId);
        if (!startPlace.universe || !assets.canEditUniverse(startPlace.universe, user.id))
            return status(404);

        return { 
            Name: startPlace.asset?.name,
            Description: startPlace.asset?.description,
            RootPlace: startPlace.id,
            StudioAccessToApisAllowed: true,
            CurrentUserHasEditPermissions: true
        };
    },
    {
        query: t.Object({
            universeId: t.Number()
        }),
        auth: true
    }
);

universes.get(
    "/get-aliases",
    () => {
        return {
            Aliases: [],
            FinalPage: true,
            PageSize: 1000,
        };
    },
    {
        query: t.Object({
            universeId: t.Number(),
            page: t.Number()
        }),
        auth: true
    }
);

universes.get(
    "/get-universe-places",
    async ({ query, user }) => {
        const universe = await prisma.universe.findFirst({
            where: { id: query.universeId },
            include: { places: { include: { asset: true } } }
        })
        if (!universe || !assets.canEditUniverse(universe, user.id))
            return status(400);
        
        return {
            FinalPage: true,
            RootPlace: universe.startPlaceId,
            Places: universe.places.map(place => ({
                PlaceId: place.id,
                Name: place.asset.name,
            })),
            PageSize: 1000,
        };
    },
    {
        query: t.Object({
            universeId: t.Number(),
            page: t.Number()
        }),
        auth: true
    }
);

universes.post(
    "/update-universe",
    async ({ query, user, body }) => {
        const universe = await prisma.universe.findFirst({
            where: { id: query.universeid }
        })
        if (!universe || !assets.canEditUniverse(universe, user.id))
            return status(400);

        await prisma.asset.update({
            where: { id: universe.startPlaceId },
            data: { name: body.Name, description: body.Description }
        })
    },
    {
        query: t.Object({
            universeid: t.Number()
        }),
        body: t.Object({
            Name: t.String({ minLength: 1, maxLength: 30 }),
            Description: t.String({ minLength: 1, maxLength: 100 }),
        }),
        auth: true
    }
)

universes.get(
    "/:id/game-start-info",
    () => ({
        r15Morphing: false
    })
)

universes.get("/get-all", async ({ user }) => {
    const universes = await prisma.universe.findMany({
        where: {
            creatorId: user.id,
            creatorType: CreatorType.User
        },
        include: { places: { include: { asset: true } } }
    });
    return {
        success: true,
        data: universes.map(u => {
            const startPlace = u.places.find(p => p.id === u.startPlaceId);
            return {
                id: u.id,
                placeId: startPlace?.id ?? null,
                name: startPlace?.asset?.name ?? null
            };
        })
    };
}, { auth: true })

export default universes;