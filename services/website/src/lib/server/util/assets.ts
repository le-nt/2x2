import prisma from "@/prisma";
import s3 from "./s3";
import crypto from "./crypto";
import { AssetCategory, AssetGenre, AssetType, CreatorType } from "@/types/types";
import logger from "./logger";
import { readFile } from "node:fs/promises";
import path from "node:path";
import config from "./config";
import { ChatStyle, Device } from "@prisma/client";
import redis from "./redis";
import arbiter from "./arbiter";
import roblox from "./roblox";
import assets from "./assets";
import { Asset, AssetDelivery } from "@/types/roblox";

const defaultMigrationTypes = [ //? Asset types that we can migrate
    AssetType.Audio,
    AssetType.Decal,
    AssetType.Image,
    AssetType.Mesh,
    AssetType.Animation
];

async function migrateRobloxAsset(assetId: number, hidden: boolean = true, migrationTypes: AssetType[] = defaultMigrationTypes) {
    if (hidden && await redis.get(`assetUnsupported:${assetId}`) !== null) {
        return null; // previously marked as unsupported
    }
    // * first use the roblox api to get asset info
    const asset = await roblox.api<Asset>(`https://economy.roblox.com/v2/assets/${assetId}/details`);
    if (asset == null)
        return null;
    if (!migrationTypes.includes(asset.AssetTypeId)) {
        if (hidden) {
            await redis.set(`assetUnsupported:${assetId}`, 1, "EX", 3600 * 24);
        }
        return null; // asset cannot be migrated
    }

    // * get assetdelivery data
    const assetDelivery = await roblox.api<AssetDelivery>(`https://assetdelivery.roblox.com/v2/asset?id=${assetId}`);
    if (assetDelivery == null)
        throw new Error("AssetDelivery returned null");

    if (!hidden) {
        const existing = await prisma.asset.findFirst({
            where: { name: asset.Name, creatorId: 1, type: asset.AssetTypeId }
        });
        if (existing) {
            throw new Error("Asset already exists");
        }
    }

    // * download asset contents
    const contents = await fetch(assetDelivery.locations[0].location);
    if (!contents.ok)
        throw new Error("Failed to download asset data");

    // * now we can upload to s3
    const buffer = await contents.arrayBuffer();
    const versionHash = await assets.upload(buffer);

    // * add the asset to the database
    const newDbAsset = await prisma.asset.create({
        data: {
            ...(hidden ? { id: assetId } : {}),
            name: asset.Name,
            description: asset.Description,
            type: asset.AssetTypeId,
            creatorId: 1,
            creatorType: CreatorType.User,
            assetGenre: AssetGenre.All,
            isMigratedAsset: hidden,
            isReviewed: !hidden,
            isApproved: !hidden
        }
    });

    // * create an asset version
    await assets.createVersion(hidden ? assetId : newDbAsset.id, versionHash);
    return versionHash;
}

// * Function to get the baseplate
const baseplate = async () => {
    const filePath = path.resolve("static/rbxl/Baseplate.rbxl");
    return await readFile(filePath);
};

// * The reason I have uploading and creating versions split in two functions is because
// * we should preferably upload the asset before creating it in case it fails
async function upload(
    contents: ArrayBuffer | Buffer,
    assetId?: number
) {
    const versionHash = crypto.sha256Hex(contents);
    const exists = await prisma.assetVersion.findFirst({
        where: { versionHash },
        select: { id: true },
    });
    if (exists) {
        logger.info(`Asset version already exists (hash ${versionHash})`);
        return versionHash;
    }

    try {
        // upload new version
        const file = s3.file(versionHash);
        await file.write(contents);
        logger.info(`New asset version uploaded: ${versionHash}`);

        // validate asset
        if (assetId) {
            await redis.set(`assetValidation:${assetId}`, versionHash, "EX", 60);
            await arbiter.newValidationDispatchment(assetId);
        }

        return versionHash;
    } catch (error) {
        logger.error(`Asset version upload failed`);
        throw error;
    }
}

async function getValidationHash(id: number) {
    return redis.get(`assetValidation:${id}`);
}

async function createVersion(assetId: number | bigint, hash: string) {
    const latest = await prisma.assetVersion.findFirst({
        where: { assetId },
        orderBy: { versionId: 'desc' },
        select: { versionId: true }
    });
    await prisma.assetVersion.create({
        data: {
            assetId,
            versionHash: hash,
            versionId: (latest?.versionId ?? 0) + 1
        }
    });
    await prisma.asset.update({
        where: { id: assetId },
        data: { updatedAt: new Date() }
    })
}

async function createGame(
    name: string,
    description: string,
    creatorId: number,
    creatorType: CreatorType,
    genre?: AssetGenre,
    playableDevices?: Device[],
    allowAnyGearGenre?: boolean,
    allowedGearCategories?: AssetCategory[],
    chatType?: ChatStyle,
    commentsAllowed?: boolean,
    copyLocked?: boolean,
    isBuildServer?: boolean,
    maxPlayers?: number,
    vipEnabled?: boolean,
    vipPrice?: number,
    templateId?: number
) {
    let versionHash: string;
    if (templateId) {
        const latestVersion = await prisma.assetVersion.findFirst({
            where: { assetId: templateId },
            orderBy: { versionId: "desc" }
        });
        if (!latestVersion)
            throw Error("Template asset was not found")
        versionHash = latestVersion.versionHash
    } else {
        versionHash = await upload(await baseplate());
    }

    const assetId = await prisma.$transaction(async (tx) => {
        const asset = await tx.asset.create({
            data: {
                name,
                description,
                type: AssetType.Place,
                creatorId,
                creatorType,
                isApproved: true,
                ...(genre !== undefined && { assetGenre: genre }),
            }
        });

        const universe = await tx.universe.create({
            data: {
                creatorId,
                creatorType,
                startPlaceId: asset.id
            }
        });

        await tx.place.create({
            data: {
                id: asset.id,
                universeId: universe.id,
                ...(playableDevices !== undefined && { playableDevices }),
                ...(allowAnyGearGenre !== undefined && { allowAnyGearGenre }),
                ...(allowedGearCategories !== undefined && { allowedGearCategories }),
                ...(chatType !== undefined && { chatStyle: chatType }),
                ...(commentsAllowed !== undefined && { commentsAllowed }),
                ...(copyLocked !== undefined && { copyLocked }),
                ...(isBuildServer !== undefined && { isBuildServer }),
                ...(maxPlayers !== undefined && { maxPlayerCount: maxPlayers }),
                ...(vipEnabled !== undefined && { vipEnabled }),
                ...(vipPrice !== undefined && { vipPrice })
            }
        });

        await tx.assetVersion.create({
            data: {
                assetId: asset.id,
                versionHash: versionHash,
                versionId: 1
            }
        });
        return asset.id;
    });

    return assetId;
}

async function createPlace(
    name: string,
    description: string,
    universe: { id: number | bigint; creatorId: number; creatorType: CreatorType }
) {
    const versionHash = await upload(await baseplate());
    const asset = await prisma.asset.create({
        data: {
            name,
            description,
            type: AssetType.Place,
            creatorId: universe.creatorId,
            creatorType: universe.creatorType,
            isApproved: true
        }
    });
    await prisma.place.create({
        data: {
            id: asset.id,
            universeId: universe.id
        }
    });

    await createVersion(asset.id, versionHash);
    return asset;
}

async function getStartPlace(universeId: number) {
    const universe = await prisma.universe.findUnique({
        where: { id: universeId }
    });
    const place = universe?.startPlaceId && await prisma.place.findUnique({
        where: { id: universe.startPlaceId },
        include: { asset: true }
    });
    return { universe, ...place };
}

export function canEditUniverse(
    universe: { creatorId: number; editors: number[] },
    userId: number,
) {
    return userId === universe.creatorId || universe.editors.includes(userId)
}

export async function getGameTemplates() {
    const templates = config.gameTemplates;
    const assets = await prisma.asset.findMany({
        where: { id: { in: templates.map(t => t.id) } },
        select: { id: true, name: true }
    });
    return assets.map(asset => {
        const template = templates.find(t => t.id === Number(asset.id))!;
        return {
            id: template.id,
            type: template.type,
            name: asset.name
        };
    });
}

export default {
    createGame,
    upload,
    createVersion,
    getStartPlace,
    canEditUniverse,
    createPlace,
    getGameTemplates,
    getValidationHash,
    migrateRobloxAsset
}