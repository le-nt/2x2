import { Elysia, t } from "elysia";
import redis from "@/util/redis";
import logger from "@/util/logger";
import { ImageType } from "@/types/thumb";
import s3 from "@/util/s3";
import { fileTypeFromBuffer } from "file-type";
import prisma from "@/prisma";
import arbiter from "@/util/arbiter"
import crypto from "@/util/crypto";
import assets from "@/util/assets";

const gameserver = new Elysia({ prefix: "/internal/gameserver", detail: {hide: true} });
gameserver.post("/upload/avatar-render", async ({ set, body }) => {
    const start = Date.now();
    const { success, hash, bust, render, width, height } = body;

    const key = `rendering:avatar${bust ? "Bust" : ""}:${width}x${height}:${hash}`;
    if (!await redis.exists(key)) {
        set.status = 400;
        logger.info("Dispatch Avatar Render failed: bad request, no lock");
        return;
    } else {
        logger.info(`Deleting avatar render lock with hash ${hash}`);
        await redis.del(key);
    }

    if (!success) {
        set.status = 200;
        return;
    }

    if (!render && success) {
        set.status = 422;
        logger.info("Dispatch Avatar Render failed: no render provided!");
        return;
    }

    /*
    !!! CHECK the render isn't literally massive so we don't get funny shit happening. set a reasonable limit of ~20 MB
    !!! even if it's the Arbiter!!! we don't care!!! security first
    todo: we gotta put this on like every dispatch endpoint pls thx
    */
    if (render && Buffer.byteLength(render, "base64") > 20 * 1024 * 1024) {
        set.status = 413;
        logger.info("Dispatch Avatar Render failed: render too large");
        return;
    }

    let buffer: Buffer | undefined;
    buffer = Buffer.from(render!, "base64");

    // check if it's a PNG, JPEG or BMP
    const allowed = ["image/png", "image/jpeg", "image/bmp"];
    const type = await fileTypeFromBuffer(buffer);
    if (!type || !allowed.includes(type.mime)) {
        set.status = 400;
        logger.info("Dispatch Avatar Render failed: bad request, unsupported image type");
        return;
    }

    // The actual image has a different hash based on its size and if its a bust or not
    const imageHash = crypto.sha256Hex(`${width}x${height}_${hash}${bust ? "BUST" : ""}`);

    // YIPPEEEE we can upload at last
    const file = s3.file(imageHash);
    const writer = file.writer({
        retry: 3,
        type: type.mime
    });
    try {
        writer.write(buffer);
        await writer.end();
    } catch (err) {
        set.status = 500;
        logger.error("Dispatch Avatar Render failed: failed to upload avatar to S3", err);
        return;
    }

    try {
        await prisma.thumbnail.create({
            data: {
                characterAppearanceHash: hash,
                imageHash,
                width,
                height,
                imageType: bust
                    ? ImageType.AvatarHeadShot
                    : ImageType.Avatar
            }
        });
    } catch (err) {
        set.status = 500;
        logger.error("Dispatch Avatar Render failed: failed to save avatar render to db", err);
        return;
    }
    logger.info(`Dispatch Avatar Render succeeded in ${Date.now() - start}ms`);
    set.status = 201;
    return;
}, {
    body: t.Object({
        "success": t.Boolean(),
        "hash": t.String(),
        "bust": t.Boolean(),
        "height": t.Number(),
        "width": t.Number(),
        "render": t.Optional(t.String())
    }),
    accessKey: true
});

gameserver.post("/upload/asset-render", async ({ set, body }) => {
    const { success, globalVersionId, height, width, render } = body;

    const assetVersion = await prisma.assetVersion.findUnique({
        where: {
            id: globalVersionId
        }
    });
    if (assetVersion === null) {
        set.status = 400;
        return;
    }

    const key = `rendering:assetVersion:${assetVersion.id}:${width}x${height}`;
    if (!await redis.exists(key)) {
        set.status = 400;
        return;
    } else {
        await redis.del(key);
    }

    if (!success) {
        set.status = 200;
        return;
    }

    if (!render && success) {
        set.status = 422;
        return;
    }

    if (render && Buffer.byteLength(render, "base64") > 20 * 1024 * 1024) {
        set.status = 413;
        return;
    }

    let buffer: Buffer | undefined;
    buffer = Buffer.from(render!, "base64");

    // check if it's a PNG, JPEG or BMP
    const allowed = ["image/png", "image/jpeg", "image/bmp"];
    const type = await fileTypeFromBuffer(buffer);
    if (!type || !allowed.includes(type.mime)) {
        set.status = 400;
        return;
    }

    const imageHash = crypto.sha256Hex(buffer);
    const file = s3.file(imageHash);
    const writer = file.writer({
        retry: 3,
        type: type.mime
    });
    try {
        writer.write(buffer);
        await writer.end();
    } catch (err) {
        set.status = 500;
        return;
    }

    try {
        await prisma.thumbnail.create({
            data: {
                assetVersionIdGlobal: globalVersionId,
                imageHash,
                width,
                height,
                imageType: ImageType.Asset
            }
        });
        set.status = 200;
        return;
    } catch (err) {
        logger.error("dispatch asset render failed", err);
        set.status = 500;
        return;
    }
}, {
    body: t.Object({
        success: t.Boolean(),
        globalVersionId: t.Number(),
        height: t.Number(),
        width: t.Number(),
        render: t.Optional(t.String())
    }),
    accessKey: true
});

gameserver.post("/heartbeat", async ({ set, body }) => {
    const { jobId, userIds } = body;

    const gameserver = await prisma.gameserver.findUnique({
        where: {
            id: jobId
        },
        include: {
            node: true
        }
    });
    if (!gameserver) {
        set.status = 400;
        return;
    }

    const users = await prisma.user.findMany({
        where: {
            id: { in: userIds },
        },
        include: {
            gameserversCurrentlyIn: true,
        },
    });

    // just set gameserver.players to users. if users is [] then players shall be [] too
    await prisma.gameserver.update({
        where: {
            id: jobId
        },
        data: {
            players: {
                set: users.map(user => ({ id: user.id }))
            },
            isLoading: false
        }
    });

    set.status = 200;
    if (users.length === 0)
        return;

    try {
        await arbiter.renewLease(jobId, gameserver.node, 60);
    } catch (error) {
        set.status = 500;
        logger.error("Dispatch Avatar Render failed: failed to renew lease", error);
        return;
    }
}, {
    body: t.Object({
        jobId: t.String(),
        userIds: t.Array(t.Number())
    }),
    accessKey: true
});

gameserver.post("/submit-validation", async ({ set, body: { id, status } }) => {
    const hash = await assets.getValidationHash(id);
    if (!hash) {
        set.status = 400;
        logger.debug("Asset validation hash is invalid");
        return;
    }

    await redis.del(`assetValidation:${id}`);
    if (status === true) // create ver if success
        await assets.createVersion(id, hash);
    else
        await s3.delete(hash);
}, {
    body: t.Object({
        id: t.Number(),
        status: t.Boolean()
    }),
    accessKey: true
})

gameserver.post("/shutdown", async ({ set, body }) => {
    const jobId = body.jobId;

    const gameserver = await prisma.gameserver.findUnique({
        where: {
            id: jobId
        },
        include: {
            node: true
        }
    });

    if (!gameserver) {
        set.status = 400;
        return;
    }

    await arbiter.reportShutdown(
        gameserver.id,
        gameserver.node
    );
    await prisma.gameserver.delete({
        where: {
            id: jobId
        }
    });
    set.status = 200;
    return;
}, {
    body: t.Object({
        jobId: t.String()
    }),
    accessKey: true
})

export default gameserver;