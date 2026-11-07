import { Elysia, status, t } from "elysia";
import auth from "@/macros/auth";
import { AssetCategory, AssetGenre, AssetType, CreatorType } from "@/types/types";
import assets from "@/util/assets";
import prisma from "@/prisma";
import { ChatStyle, Device } from "@prisma/client";
import config from "@/util/config";
import { dev } from "$app/environment";

const allowedAssets = [AssetType.Place];
const developApi = new Elysia({ prefix: "/develop" })
    .use(auth.as("scoped"));

developApi.post(
    "/create",
    async ({ body, user }) => {
        if (!allowedAssets.includes(body.type))
            return status(400);
        let assetId;
        switch (body.type) {
            case AssetType.Place:
                assetId = await assets.createGame(
                    body.name,
                    body.description,
                    user.id,
                    CreatorType.User,
                    body.genre
                );
                break;
            default:
                throw Error("Unsupported");
        }
        return assetId;
    },
    {
        body: t.Object({
            name: t.String({ minLength: 1, maxLength: 30 }),
            description: t.String({ minLength: 0, maxLength: 1000 }),
            type: t.Enum(AssetType),
            genre: t.Enum(AssetGenre)
        }),
        auth: true
    }
)

developApi.post(
    "/create-place",
    async ({ body, user }) => {
        return assets.createGame(
            body.name,
            body.description,
            user.id,
            CreatorType.User,
            body.genre,
            body.playableDevices,
            body.allowAnyGearGenre,
            body.allowedGearCategories,
            body.chatType,
            body.commentsAllowed,
            body.copyLocked,
            body.isBuildServer,
            body.maxPlayers,
            body.vipEnabled,
            body.vipPrice,
            body.templateId
        );
    },
    {
        body: t.Object({
            name: t.String({ minLength: 1, maxLength: 30 }),
            description: t.String({ minLength: 0, maxLength: 1000 }),
            genre: t.Enum(AssetGenre),
            playableDevices: t.Array(t.Enum(Device)),
            allowAnyGearGenre: t.Boolean(),
            allowedGearCategories: t.Array(t.Enum(AssetCategory)),
            chatType: t.Enum(ChatStyle),
            commentsAllowed: t.Boolean(),
            copyLocked: t.Boolean(),
            isBuildServer: t.Boolean(),
            maxPlayers: t.Number({ minimum: 1, maximum: 50 }),
            vipEnabled: t.Boolean(),
            vipPrice: t.Number({ minimum: 1, maximum: 5000 }),
            templateId: t.Union(config.gameTemplates.map(tpl => t.Literal(tpl.id)))
        }),
        auth: true
    }
)

developApi.post(
    "/upload",
    async ({ request, user, query: { assetId } }) => {
        const asset = await prisma.asset.findFirst({
            where: {
                id: assetId,
                type: AssetType.Place,
                creatorId: user.id,
                creatorType: CreatorType.User
            }
        })
        if (!asset)
            return status(404);
        if (await assets.getValidationHash(assetId))
            return status(403);

        // ungzip file and upload
        const raw = Buffer.from(await request.arrayBuffer());
        const file = Bun.gunzipSync(raw);
        await assets.upload(Buffer.from(file), !dev ? assetId : undefined);
        
        // wait for validation hash to clear
        // this isnt great but it makes studio show loading while validating
        if (!dev) {
            const start = Date.now();
            while (true) {
                const hash = await assets.getValidationHash(assetId);
                if (hash === null) break; // done
                if (Date.now() - start > 60_000) {
                    throw new Error("Timed out waiting for validation hash to clear");
                }
                await new Promise((res) => setTimeout(res, 1000));
            }
        }
    },
    {
        type: "application/octet-stream",
        query: t.Object({
            assetId: t.Number()
        }),
        auth: true
    }
);

export default developApi;
