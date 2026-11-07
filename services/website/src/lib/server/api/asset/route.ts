import { Context, Elysia, redirect, t } from "elysia";
import logger from "@/util/logger";
import prisma from "@/prisma";
import { AssetType } from "@/types/types";
import config from "@/util/config";
import assets from "@/util/assets";
import users from "@/util/users";

const asset = new Elysia() //? Elysia, why's it so hard to not be case sensitive?
    .get("/Asset", handleAssetRequest, {
        detail: {
            hide: true
        }
    })
    .get("/asset", handleAssetRequest)

asset.get("/asset/characterappearance", async ({ set, query }) => {
    const userId = Number(query.userId);
    if (!userId) {
        set.status = 400;
        return { error: "Missing userId" };
    }

    try {
        const characterAppearanceString = await users.getCharacterAppearanceString(userId);
        return { characterAppearance: characterAppearanceString };
    } catch (error) {
        set.status = 500;
        return;
    }
}, {
    query: t.Object({
        userId: t.Number()
    })
});

asset.get("/asset/xmlbodycolors", async ({ set, query }) => {

})

async function handleAssetRequest(context: Context) {
    // * consts
    const { set } = context;
    const query = Object.keys(context.query).reduce((acc, key) => {
        acc[key.toLowerCase()] = context.query[key];
        return acc;
    }, {} as Record<string, any>);

    query.id = Number(query.id);
    query.assetversionid = query.assetversionid !== undefined ? Number(query.assetversionid) : undefined;
    const headers = context.headers as { accesskey?: string }
    const isGameserver = (headers.accesskey == config.webserver.assetAccessKey)

    // * now that's all over let's get the asset in question...
    const asset = await prisma.asset.findFirst({
        where: {
            id: query.id
        },
        include: {
            versions: true,
            place: true
        }
    })
    if (!asset) {
        console.warn(`AssetDelivery: Asset with ID ${query.id} not found`);
        try {
            const hash = await assets.migrateRobloxAsset(query.id); // * we don't need any further config - assetdelivery config is defaulted
            if (hash !== null)
                return redirect(`${config.s3.baseUrl}/${hash}`, 307)
            set.status = 404;
            return { success: false, error: "NotFound", code: 404, message: "The requested resource was not found on this server." }
        } catch (error) {
            logger.error(`AssetDelivery: Failed to migrate asset ${query.id}`, error);
            set.status = 500;
            return { success: false, error: "InternalServerError", code: 500, message: "An internal server error occurred." }
        }
    }
    if (!isGameserver && asset.type === AssetType.Place) {
        set.status = 401;
        return { success: false, error: "Unauthorized", code: 401, message: "You do not have rights to this Place." } // todo: if you own the place, you can download it
    }

    // * asset validation
    const validationHash = await assets.getValidationHash(query.id);
    if (isGameserver && validationHash && query.validate == true)
        return redirect(`${config.s3.baseUrl}/${validationHash}`, 307);

    // * get the latest version of the asset
    if (query.assetversionid) {
        const version = asset.versions.find(v => v.versionId === query.assetversionid);
        if (!version) {
            set.status = 404;
            return { success: false, error: "NotFound", code: 404, message: "Invalid Version ID" }
        }
        return redirect(`${config.s3.baseUrl}/${version.versionHash}`, 307);
    }
    const assetVersions = asset.versions;
    if (assetVersions.length == 0 || (isGameserver && asset.type === AssetType.Place && !asset.place)) {
        logger.error(`AssetDelivery: Threw 500 - place ${query.id} has no versions or no Place entry`)
        set.status = 500;
        return;
    }
    const newestVersion = assetVersions.reduce((max, curr) =>
        !max || curr.versionId > max.versionId ? curr : max, null as typeof assetVersions[0] | null
    );
    return redirect(`${config.s3.baseUrl}/${newestVersion?.versionHash}`, 307)
}

export default asset;