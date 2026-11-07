import { Elysia, t } from "elysia";
import users from "@/util/users";
import prisma from "@/prisma";
import arbiter from "@/util/arbiter";
import { ImageType, findBySize } from "@/types/thumb";
import redis from "@/util/redis";
import crypto from "@/util/crypto";
import config from "@/util/config";

const thumbnail = new Elysia({ prefix: "/thumbnail" });

thumbnail.post(
  "/get-avatar",
  async ({ set, body }) => {
    const { id, bust, height, width } = body;
    const imageType = bust ? ImageType.AvatarHeadShot : ImageType.Avatar;

    const size = findBySize(imageType, width, height);
    if (size == null) {
      set.status = 400;
      return { success: false, imageUrl: null, message: "Invalid image size" };
    }

    try {
      const charApp = await users.getCharacterAppearanceString(id, false);
      if (charApp == null) {
        set.status = 400;
        return {
          success: false,
          imageUrl: null,
          message: "User does not exist",
        };
      }

      const hash = crypto.sha256Hex(charApp);
      const key = `rendering:avatar${bust ? "Bust" : ""}:${width}x${height}:${hash}`;
      if (await redis.exists(key)) {
        set.status = 202;
        return { success: true, imageUrl: null, message: "Waiting for render" };
      }

      const render = await prisma.thumbnail.findFirst({
        where: {
          imageType,
          characterAppearanceHash: hash,
          width,
          height,
        },
      });

      if (!render) {
        set.status = 202;
        await arbiter.newAvatarDispatchment(id, hash, bust, width, height);
        return {
          success: true,
          imageUrl: null,
          message: "Requesting render dispatchment",
        };
      } else {
        set.status = 200;
        return {
          success: true,
          imageUrl: `${config.s3.baseUrl}/${render.imageHash}`,
          message: "OK",
        };
      }
    } catch (err) {
      set.status = 500;
      return {
        success: false,
        imageUrl: null,
        message: `${(err as Error).message || "Unknown error"}`,
      };
    }
  },
  {
    body: t.Object({
      id: t.Number(),
      bust: t.Boolean(),
      height: t.Number(),
      width: t.Number(),
    }),
  },
);

thumbnail.post(
  "/get-asset",
  async ({ set, body }) => {
    const { id, assetVersionId, game, height, width } = body;
    const imageType = game ? ImageType.Game : ImageType.Asset;

    const size = findBySize(imageType, width, height);
    if (size == null) {
      set.status = 400;
      return { success: false, imageUrl: null, message: "Invalid image size" };
    }

    const key = `rendering:assetVersion:${assetVersionId}:${width}x${height}`;
    if (await redis.exists(key)) {
      set.status = 202;
      return { success: true, imageUrl: null, message: "Waiting for render" };
    }

    try {
      const assetVersion =
        assetVersionId != null
          ? await prisma.assetVersion.findFirst({
              where: { id: assetVersionId, assetId: id },
              include: { asset: { include: { place: true } }, renders: true },
            })
          : await prisma.assetVersion.findFirst({
              where: { assetId: id },
              include: { asset: { include: { place: true } }, renders: true },
              orderBy: { versionId: "desc" },
            });
      if (!assetVersion) {
        set.status = 404;
        return {
          success: false,
          imageUrl: null,
          message: "Asset or asset version not found",
        };
      }
      if (game && assetVersion?.asset?.place == null) {
        set.status = 400;
        return {
          success: false,
          imageUrl: null,
          message: "Game does not exist",
        };
      }

      for (const render of assetVersion.renders) {
        if (render.width === width && render.height === height) {
          set.status = 200;
          return {
            success: true,
            imageUrl: `${config.s3.baseUrl}/${render.imageHash}`,
            message: "OK",
          };
        }
      }

      set.status = 202;
      await arbiter.newAssetDispatchment(assetVersion.id, width, height);
      return {
        success: true,
        imageUrl: null,
        message: "Requesting render dispatchment",
      };
    } catch (err) {
      set.status = 500;
      return {
        success: false,
        imageUrl: null,
        message: `${(err as Error).message || "Unknown error"}`,
      };
    }
  },
  {
    body: t.Object({
      id: t.Number(),
      assetVersionId: t.Optional(t.Number()),
      height: t.Number(),
      width: t.Number(),
      game: t.Boolean(),
    }),
  },
);

export default thumbnail;
